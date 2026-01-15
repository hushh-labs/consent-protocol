"use client";

/**
 * Professional Profile Editor Component
 *
 * Inline editor for professional profile following Kai patterns.
 * Encrypts data client-side before submission.
 */

import { useState } from "react";
import { encryptData } from "@/lib/vault/encrypt";
import { ApiService } from "@/lib/services/api-service";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/lib/morphy-ux/morphy";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const SKILL_CATEGORIES = {
  languages: [
    "Python",
    "JavaScript",
    "TypeScript",
    "Java",
    "C#",
    "Go",
    "Rust",
    "C++",
  ],
  frontend: [
    "React",
    "Next.js",
    "Vue",
    "Angular",
    "Svelte",
    "HTML/CSS",
    "Tailwind",
  ],
  backend: [
    "Node.js",
    ".NET",
    "Django",
    "Flask",
    "FastAPI",
    "Spring Boot",
    "Express",
  ],
  cloud: ["AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "CI/CD"],
  data_ai: [
    "Machine Learning",
    "Data Science",
    "SQL",
    "NoSQL",
    "AI/LLM",
    "Data Engineering",
  ],
};

const EXPERIENCE_LEVELS = [
  "Entry Level (0-2 years)",
  "Mid Level (3-5 years)",
  "Senior (5-8 years)",
  "Staff/Principal (8+ years)",
];

const JOB_TYPES = [
  "Full-time",
  "Contract",
  "Part-time",
  "Freelance",
  "Consulting",
];

interface ProfessionalProfileEditorProps {
  initialProfile?: {
    professional_title: string;
    skills: string[];
    experience_level: string;
    job_preferences: string[];
  };
  userId: string;
  vaultKey: string;
  vaultOwnerToken: string;
  onSave: () => Promise<void>;
  onCancel: () => void;
}

export function ProfessionalProfileEditor({
  initialProfile,
  userId,
  vaultKey,
  vaultOwnerToken,
  onSave,
  onCancel,
}: ProfessionalProfileEditorProps) {
  const [title, setTitle] = useState(initialProfile?.professional_title || "");
  const [skills, setSkills] = useState<string[]>(initialProfile?.skills || []);
  const [experienceLevel, setExperienceLevel] = useState(
    initialProfile?.experience_level || ""
  );
  const [jobPreferences, setJobPreferences] = useState<string[]>(
    initialProfile?.job_preferences || []
  );
  const [loading, setLoading] = useState(false);

  // Flatten all skills for easy selection
  const allSkills = Object.values(SKILL_CATEGORIES).flat();

  function toggleSkill(skill: string) {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  function toggleJobPreference(pref: string) {
    setJobPreferences((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (!userId || !vaultKey || !vaultOwnerToken) {
        throw new Error(
          "Vault locked or session expired. Please unlock vault."
        );
      }

      // Encrypt profile fields client-side
      console.log("🔒 Encrypting professional profile...");

      // Prepare encrypted fields (only fields that have data)
      const encryptedFields: Record<string, any> = {};
      
      if (title) {
        encryptedFields.professional_title = await encryptData(
          JSON.stringify(title),
          vaultKey
        );
      }
      
      if (skills.length > 0) {
        encryptedFields.skills = await encryptData(
          JSON.stringify(skills),
          vaultKey
        );
      }
      
      if (experienceLevel) {
        encryptedFields.experience_level = await encryptData(
          JSON.stringify(experienceLevel),
          vaultKey
        );
      }
      
      if (jobPreferences.length > 0) {
        encryptedFields.job_preferences = await encryptData(
          JSON.stringify(jobPreferences),
          vaultKey
        );
      }

      // Store each field individually via platform-aware routing
      // Web: /api/vault/professional → Python /api/professional/preferences/store
      // Native: HushhVault plugin → Python /api/professional/preferences/store
      for (const [fieldName, encrypted] of Object.entries(encryptedFields)) {
        const response = await ApiService.storeProfessionalPreference({
          userId,
          fieldName,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          tag: encrypted.tag,
          consentToken: vaultOwnerToken,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to save ${fieldName}:`, errorText);
          throw new Error(`Failed to save ${fieldName}`);
        }
      }

      console.log("✅ Professional profile saved to vault");
      toast.success("Professional profile saved securely");

      // Call parent onSave to reload and close editor
      await onSave();
    } catch (error: any) {
      console.error("Error saving professional profile:", error);
      toast.error(error.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card variant="none" effect="glass" className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>💼 Edit Professional Profile</CardTitle>
        <CardDescription>
          This data is encrypted locally before storage. Server never sees your
          plaintext profile.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Professional Title */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Professional Title</label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Senior Software Engineer"
              required
              disabled={loading}
              className="w-full"
            />
          </div>

          {/* Skills */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Skills (select all that apply)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 border rounded-lg">
              {allSkills.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  disabled={loading}
                  className={`p-2 rounded-lg border text-xs transition-colors disabled:opacity-50 ${
                    skills.includes(skill)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-muted border-border"
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {skills.length} skill{skills.length !== 1 ? "s" : ""} selected
            </p>
          </div>

          {/* Experience Level */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Experience Level</label>
            <select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value)}
              required
              disabled={loading}
              className="w-full p-3 rounded-lg border bg-card disabled:opacity-50"
            >
              <option value="">Select experience level</option>
              {EXPERIENCE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          {/* Job Preferences */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Job Preferences</label>
            <div className="grid grid-cols-2 gap-2">
              {JOB_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleJobPreference(type)}
                  disabled={loading}
                  className={`p-3 rounded-lg border text-sm transition-colors disabled:opacity-50 ${
                    jobPreferences.includes(type)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-muted border-border"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </form>
      </CardContent>

      <CardFooter className="flex gap-3 justify-end">
        <Button
          type="button"
          variant="none"
          effect="glass"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          onClick={handleSubmit}
          disabled={loading}
          variant="gradient"
          effect="glass"
          showRipple
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {loading ? "Saving..." : "Save Profile 🔒"}
        </Button>
      </CardFooter>
    </Card>
  );
}
