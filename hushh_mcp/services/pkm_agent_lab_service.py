from __future__ import annotations

import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Any

from hushh_mcp.constants import GEMINI_MODEL
from hushh_mcp.hushh_adk.manifest import ManifestLoader

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[2]
_MANIFEST_PATH = _REPO_ROOT / "hushh_mcp" / "agents" / "pkm_structure" / "agent.yaml"

_STRUCTURE_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "action": {
            "type": "STRING",
            "enum": ["match_existing_domain", "create_domain", "extend_domain"],
        },
        "target_domain": {"type": "STRING"},
        "json_paths": {"type": "ARRAY", "items": {"type": "STRING"}},
        "top_level_scope_paths": {"type": "ARRAY", "items": {"type": "STRING"}},
        "externalizable_paths": {"type": "ARRAY", "items": {"type": "STRING"}},
        "summary_projection": {"type": "OBJECT"},
        "sensitivity_labels": {"type": "OBJECT"},
        "confidence": {"type": "NUMBER"},
        "source_agent": {"type": "STRING"},
        "contract_version": {"type": "INTEGER"},
    },
    "required": [
        "action",
        "target_domain",
        "json_paths",
        "top_level_scope_paths",
        "externalizable_paths",
        "summary_projection",
        "sensitivity_labels",
        "confidence",
        "source_agent",
        "contract_version",
    ],
}


class PKMAgentLabService:
    def __init__(self) -> None:
        self._manifest = None
        self._client = None

    @property
    def manifest(self):
        if self._manifest is None:
            self._manifest = ManifestLoader.load(str(_MANIFEST_PATH))
        return self._manifest

    @property
    def client(self):
        if self._client is not None:
            return self._client
        api_key = (
            str(os.getenv("GEMINI_API_KEY", "")).strip()
            or str(os.getenv("GOOGLE_API_KEY", "")).strip()
            or str(os.getenv("GOOGLE_GENAI_API_KEY", "")).strip()
        )
        if not api_key:
            return None
        try:
            from google import genai

            self._client = genai.Client(api_key=api_key)
        except Exception as exc:
            logger.warning("pkm.agent_lab_client_unavailable error=%s", exc)
            self._client = None
        return self._client

    @staticmethod
    def _normalize_segment(value: str) -> str:
        normalized = "".join(
            ch if (ch.isalnum() or ch == "_") else "_" for ch in value.strip().lower()
        )
        return normalized.strip("_")

    @classmethod
    def _normalize_path(cls, value: str) -> str:
        parts = [cls._normalize_segment(part) for part in str(value or "").split(".")]
        return ".".join(part for part in parts if part)

    @classmethod
    def _titleize_path(cls, value: str) -> str:
        return " ".join(part.replace("_", " ").title() for part in value.split(".") if part)

    @classmethod
    def _infer_sensitivity(cls, path: str) -> str | None:
        normalized = path.lower()
        if any(token in normalized for token in ("ssn", "tax", "account_number", "routing")):
            return "restricted"
        if any(token in normalized for token in ("risk", "portfolio", "holdings", "income")):
            return "confidential"
        return None

    @classmethod
    def _walk_payload(
        cls,
        value: Any,
        path: list[str],
        paths: dict[str, dict[str, Any]],
    ) -> None:
        if value is None:
            return

        current_path = ".".join(path)
        if current_path:
            is_array = isinstance(value, list)
            is_object = isinstance(value, dict)
            paths[current_path] = {
                "json_path": current_path,
                "parent_path": ".".join(path[:-1]) if len(path) > 1 else None,
                "path_type": "array" if is_array else "object" if is_object else "leaf",
                "exposure_eligibility": True,
                "consent_label": cls._titleize_path(current_path),
                "sensitivity_label": cls._infer_sensitivity(current_path),
                "segment_id": path[0] if path else "root",
                "source_agent": "pkm_structure_agent",
            }

        if isinstance(value, list):
            sample = next((item for item in value if item is not None), None)
            if sample is not None:
                cls._walk_payload(sample, [*path, "_items"], paths)
            return

        if not isinstance(value, dict):
            return

        for raw_key, child_value in value.items():
            normalized_key = cls._normalize_segment(str(raw_key))
            if normalized_key:
                cls._walk_payload(child_value, [*path, normalized_key], paths)

    @classmethod
    def _build_manifest_from_payload(
        cls,
        *,
        user_id: str,
        domain: str,
        payload: dict[str, Any],
        structure_decision: dict[str, Any],
    ) -> dict[str, Any]:
        path_map: dict[str, dict[str, Any]] = {}
        cls._walk_payload(payload, [], path_map)
        paths = [path_map[key] for key in sorted(path_map)]
        top_level_scope_paths = sorted(
            {path["json_path"].split(".", 1)[0] for path in paths if path["json_path"]}
        )
        externalizable_paths = [path["json_path"] for path in paths if path["exposure_eligibility"]]
        segment_ids = sorted({path.get("segment_id") or "root" for path in paths}) or ["root"]
        scope_registry = []
        for scope_path in top_level_scope_paths:
            scope_registry.append(
                {
                    "scope_handle": f"s_{hashlib.sha256(f'{user_id}:{domain}:{scope_path}'.encode('utf-8')).hexdigest()[:12]}",
                    "scope_label": cls._titleize_path(scope_path),
                    "segment_ids": sorted(
                        {
                            path.get("segment_id") or "root"
                            for path in paths
                            if path["json_path"] == scope_path
                            or path["json_path"].startswith(f"{scope_path}.")
                        }
                    ),
                    "sensitivity_tier": "restricted"
                    if any(
                        (path.get("sensitivity_label") or "").lower() == "restricted"
                        for path in paths
                        if path["json_path"] == scope_path
                        or path["json_path"].startswith(f"{scope_path}.")
                    )
                    else "confidential",
                    "scope_kind": "subtree",
                    "exposure_enabled": True,
                    "summary_projection": {"top_level_scope_path": scope_path},
                }
            )
        for entry in scope_registry:
            for path in paths:
                if path["json_path"] == entry["summary_projection"]["top_level_scope_path"] or path[
                    "json_path"
                ].startswith(f"{entry['summary_projection']['top_level_scope_path']}."):
                    path["scope_handle"] = entry["scope_handle"]
        return {
            "user_id": user_id,
            "domain": domain,
            "manifest_version": 1,
            "structure_decision": structure_decision,
            "summary_projection": structure_decision.get("summary_projection") or {},
            "top_level_scope_paths": top_level_scope_paths,
            "externalizable_paths": externalizable_paths,
            "segment_ids": segment_ids,
            "path_count": len(paths),
            "externalizable_path_count": len(externalizable_paths),
            "paths": paths,
            "scope_registry": scope_registry,
        }

    def _fallback_structure_decision(
        self,
        *,
        message: str,
        current_domains: list[str],
        candidate_domain: str | None,
        candidate_data: dict[str, Any] | None,
    ) -> dict[str, Any]:
        normalized_domains = [
            self._normalize_segment(domain) for domain in current_domains if domain
        ]
        target_domain = self._normalize_segment(candidate_domain or "")
        if not target_domain:
            target_domain = normalized_domains[0] if normalized_domains else "general"

        path_map: dict[str, dict[str, Any]] = {}
        if candidate_data:
            self._walk_payload(candidate_data, [], path_map)
        json_paths = sorted(path_map.keys())
        top_level_scope_paths = sorted({path.split(".", 1)[0] for path in json_paths if path})
        externalizable_paths = list(json_paths)
        sensitivity_labels = {
            path: label
            for path, label in (
                (path, path_map[path].get("sensitivity_label")) for path in json_paths
            )
            if isinstance(label, str) and label
        }
        action = "match_existing_domain" if target_domain in normalized_domains else "create_domain"
        if target_domain in normalized_domains and json_paths:
            action = "extend_domain"
        return {
            "action": action,
            "target_domain": target_domain,
            "json_paths": json_paths,
            "top_level_scope_paths": top_level_scope_paths,
            "externalizable_paths": externalizable_paths,
            "summary_projection": {
                "message_excerpt": message[:120],
                "path_count": len(json_paths),
                "top_level_scope_count": len(top_level_scope_paths),
            },
            "sensitivity_labels": sensitivity_labels,
            "confidence": 0.55,
            "source_agent": "pkm_structure_agent",
            "contract_version": 1,
        }

    async def generate_structure_preview(
        self,
        *,
        user_id: str,
        message: str,
        current_domains: list[str] | None = None,
        candidate_domain: str | None = None,
        candidate_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        normalized_domains = [
            self._normalize_segment(domain) for domain in (current_domains or []) if domain
        ]
        decision = self._fallback_structure_decision(
            message=message,
            current_domains=normalized_domains,
            candidate_domain=candidate_domain,
            candidate_data=candidate_data,
        )
        used_fallback = True
        error_message = None

        if self.client is not None:
            try:
                from google.genai import types as genai_types

                prompt = (
                    f"{self.manifest.system_instruction}\n\n"
                    "Return JSON only. Do not include markdown.\n"
                    f"Current domains: {json.dumps(normalized_domains)}\n"
                    f"Candidate domain hint: {json.dumps(candidate_domain)}\n"
                    f"Natural language request: {message}\n"
                    f"Candidate data sample: {json.dumps(candidate_data or {}, sort_keys=True)}"
                )
                config = genai_types.GenerateContentConfig(
                    temperature=0.0,
                    response_mime_type="application/json",
                    automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(
                        disable=True
                    ),
                    response_schema=_STRUCTURE_RESPONSE_SCHEMA,
                )
                response = await self.client.aio.models.generate_content(
                    model=self.manifest.model or GEMINI_MODEL,
                    contents=prompt,
                    config=config,
                )
                parsed = (
                    response.parsed if isinstance(getattr(response, "parsed", None), dict) else None
                )
                if parsed is None:
                    parsed = json.loads((response.text or "").strip() or "{}")
                if isinstance(parsed, dict):
                    decision = {
                        **decision,
                        **parsed,
                        "target_domain": self._normalize_segment(
                            str(parsed.get("target_domain") or decision["target_domain"])
                        )
                        or decision["target_domain"],
                        "source_agent": str(parsed.get("source_agent") or "pkm_structure_agent"),
                    }
                    used_fallback = False
            except Exception as exc:
                error_message = str(exc)
                logger.warning("pkm.agent_lab_generation_failed error=%s", exc)

        manifest = None
        if candidate_data and isinstance(candidate_data, dict):
            manifest = self._build_manifest_from_payload(
                user_id=user_id,
                domain=decision["target_domain"],
                payload=candidate_data,
                structure_decision=decision,
            )

        return {
            "agent_id": self.manifest.id,
            "agent_name": self.manifest.name,
            "model": self.manifest.model,
            "used_fallback": used_fallback,
            "error": error_message,
            "structure_decision": decision,
            "manifest_draft": manifest,
        }


_pkm_agent_lab_service: PKMAgentLabService | None = None


def get_pkm_agent_lab_service() -> PKMAgentLabService:
    global _pkm_agent_lab_service
    if _pkm_agent_lab_service is None:
        _pkm_agent_lab_service = PKMAgentLabService()
    return _pkm_agent_lab_service
