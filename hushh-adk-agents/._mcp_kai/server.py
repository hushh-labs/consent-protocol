"""
Hushh Kai MCP Server 🤫

MCP (Model Context Protocol) server that provides consent-aware tools
for the Kai Deal Optimizer agent. Demonstrates Hushh's consent-first
architecture using FastMCP.

Usage:
    uv run mcp-server/server.py
"""

import asyncio
import logging
import os
from datetime import datetime

from fastmcp import FastMCP

logger = logging.getLogger(__name__)
logging.basicConfig(format="[%(levelname)s]: %(message)s", level=logging.INFO)

# Initialize FastMCP server with Hushh branding
mcp = FastMCP("Hushh Kai MCP Server 🤫💰")


@mcp.tool()
def request_data_consent(data_type: str, purpose: str) -> dict:
    """
    Request user consent before accessing any personal data.
    This implements Hushh's MCP consent-first pattern.

    Args:
        data_type: Type of data to access (e.g., "device_info", "purchase_history")
        purpose: Why Kai needs this data

    Returns:
        Consent request details for the user to approve
    """
    logger.info(f"🔐 Consent requested for: {data_type}")
    return {
        "consent_requested": True,
        "data_type": data_type,
        "purpose": purpose,
        "timestamp": datetime.now().isoformat(),
        "message": f"🔐 Hey! Kai here. I need your permission to access your {data_type} to {purpose}. Is that cool with you?",
        "hushh_principle": "Your data, your choice. Always."
    }


@mcp.tool()
def get_device_resale_value(
    device_model: str,
    storage_size: str,
    condition: str = "good"
) -> dict:
    """
    Get current market resale values for a device across multiple platforms.
    This is Kai's core hustler research capability.

    Args:
        device_model: Device model (e.g., "iPhone 15 Pro", "iPhone 14")
        storage_size: Storage capacity (e.g., "128GB", "256GB", "512GB")
        condition: Device condition ("excellent", "good", "fair")

    Returns:
        Market analysis with prices across platforms and Kai's recommendation
    """
    logger.info(f"💰 Researching resale value: {device_model} {storage_size} ({condition})")

    # Base resale prices (simulated - would call real APIs in production)
    base_prices = {
        "iPhone 15 Pro Max": {"256GB": 950, "512GB": 1050, "1TB": 1150},
        "iPhone 15 Pro": {"128GB": 750, "256GB": 850, "512GB": 950, "1TB": 1050},
        "iPhone 15 Plus": {"128GB": 600, "256GB": 700, "512GB": 800},
        "iPhone 15": {"128GB": 550, "256GB": 650, "512GB": 750},
        "iPhone 14 Pro Max": {"128GB": 700, "256GB": 800, "512GB": 900, "1TB": 1000},
        "iPhone 14 Pro": {"128GB": 600, "256GB": 700, "512GB": 800, "1TB": 900},
        "iPhone 14": {"128GB": 450, "256GB": 550, "512GB": 650},
        "iPhone 13 Pro": {"128GB": 450, "256GB": 550, "512GB": 650, "1TB": 750},
        "iPhone 13": {"128GB": 350, "256GB": 450, "512GB": 550},
    }

    # Condition modifiers
    condition_mod = {
        "excellent": 1.10,  # Mint condition premium
        "good": 1.00,       # Standard pricing
        "fair": 0.80,       # Visible wear discount
        "poor": 0.60        # Significant damage
    }

    # Get base price or default
    model_prices = base_prices.get(device_model, {})
    base_price = model_prices.get(storage_size, 500)
    mod = condition_mod.get(condition.lower(), 1.0)
    adjusted_price = int(base_price * mod)

    # Platform-specific pricing (simulating real market differences)
    platforms = {
        "eBay": {
            "price": adjusted_price + 50,
            "fees": "~13%",
            "speed": "1-2 weeks",
            "note": "Highest price but fees eat into profit"
        },
        "Swappa": {
            "price": adjusted_price + 20,
            "fees": "~3%",
            "speed": "3-7 days",
            "note": "Best for phones - low fees, fast sales"
        },
        "Facebook Marketplace": {
            "price": adjusted_price - 20,
            "fees": "0%",
            "speed": "1-3 days",
            "note": "No fees but requires local meetup"
        },
        "Apple Trade-In": {
            "price": adjusted_price - 100,
            "fees": "0%",
            "speed": "Instant credit",
            "note": "Convenient but lowest value"
        },
        "Gazelle": {
            "price": adjusted_price - 50,
            "fees": "0%",
            "speed": "1-2 weeks",
            "note": "Easy mail-in, fair prices"
        }
    }

    # Find best platform
    best_platform = max(platforms.items(), key=lambda x: x[1]["price"])

    return {
        "device": device_model,
        "storage": storage_size,
        "condition": condition,
        "base_value": adjusted_price,
        "platforms": platforms,
        "best_platform": best_platform[0],
        "best_price": best_platform[1]["price"],
        "kai_tip": f"💡 The hustler move: List on {best_platform[0]} for ${best_platform[1]['price']}! That's ${best_platform[1]['price'] - (adjusted_price - 100)} more than Apple Trade-In would give you.",
        "potential_savings": best_platform[1]["price"] - (adjusted_price - 100)
    }


@mcp.tool()
def get_market_timing_advice(device_model: str) -> dict:
    """
    Get Kai's hustler insight on WHEN to sell for maximum value.
    Timing is everything in the resale game!

    Args:
        device_model: The device model being sold

    Returns:
        Timing analysis and strategic selling advice
    """
    logger.info(f"📈 Analyzing market timing for: {device_model}")

    # Simulated market timing data
    current_month = datetime.now().month

    timing_insights = {
        "device": device_model,
        "current_market": "stable" if current_month < 8 else "declining",
        "key_dates": {
            "apple_event": "September (usually second week)",
            "price_drop_expected": "10-20% after new iPhone announcement",
            "holiday_demand": "November-December sees increased buyer activity"
        },
        "recommendation": "",
        "urgency": ""
    }

    # Generate dynamic recommendation based on timing
    if current_month < 7:
        timing_insights["recommendation"] = "HOLD - Prices stable. Sell in July before rumors heat up."
        timing_insights["urgency"] = "low"
    elif current_month < 9:
        timing_insights["recommendation"] = "SELL NOW! Apple event coming soon. Prices drop 15-20% after announcement."
        timing_insights["urgency"] = "high"
    elif current_month < 11:
        timing_insights["recommendation"] = "SELL QUICK - Post-announcement dip happening. Prices recovering for holidays."
        timing_insights["urgency"] = "medium"
    else:
        timing_insights["recommendation"] = "GOOD TIME - Holiday buyers are active. Demand is up!"
        timing_insights["urgency"] = "medium"

    timing_insights["kai_advice"] = f"🔥 Real talk: {timing_insights['recommendation']} The smart money moves BEFORE the crowd figures it out."

    return timing_insights


@mcp.tool()
def compare_upgrade_options(
    current_device: str,
    budget: int,
    priorities: str = "performance"
) -> dict:
    """
    Kai helps you figure out what you can upgrade to with your resale money.
    Part of the "sell old to fund new" hustler strategy.

    Args:
        current_device: What you're selling
        budget: Additional budget beyond resale value
        priorities: What matters most (performance, camera, battery, value)

    Returns:
        Upgrade recommendations that maximize your value
    """
    logger.info(f"🎯 Analyzing upgrade paths from {current_device} with ${budget} extra budget")

    # Simplified upgrade recommendations
    upgrade_options = [
        {
            "device": "iPhone 15 Pro",
            "new_price": 999,
            "refurb_price": 849,
            "why": "Best overall - titanium, action button, USB-C",
            "kai_score": 9
        },
        {
            "device": "iPhone 15",
            "new_price": 799,
            "refurb_price": 679,
            "why": "Great value - Dynamic Island, USB-C",
            "kai_score": 8
        },
        {
            "device": "iPhone 14 Pro",
            "new_price": 0,  # Discontinued new
            "refurb_price": 699,
            "why": "Hidden gem - Pro features at non-Pro price",
            "kai_score": 8.5
        },
        {
            "device": "Gaming Laptop (ROG/Legion)",
            "new_price": 1200,
            "refurb_price": 900,
            "why": "For the gamers - your iPhone money can fund this!",
            "kai_score": 10
        }
    ]

    return {
        "selling": current_device,
        "extra_budget": budget,
        "priorities": priorities,
        "upgrade_options": upgrade_options,
        "kai_strategy": f"💡 The play: Sell your {current_device} on Swappa, add ${budget}, and you're gaming in style!"
    }


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    logger.info(f"🚀 Hushh Kai MCP Server starting on port {port}")
    logger.info("🤫 Consent-first. Hustle-smart. Your data, your power.")

    asyncio.run(
        mcp.run_async(
            transport="http",
            host="0.0.0.0",
            port=port,
        )
    )
