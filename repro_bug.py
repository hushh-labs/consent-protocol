
def parse_bulk_food_input(text, collected={}):
    text_lower = text.lower()
    
    # 1. Extract dietary restrictions
    dietary_keywords = {
        "vegetarian": ["vegetarian", "no meat"],
        "vegan": ["vegan", "plant-based", "plant based"],
        "gluten_free": ["gluten-free", "gluten free", "no gluten", "celiac"],
        "dairy_free": ["dairy-free", "dairy free", "no dairy", "lactose"],
        "nut_free": ["nut-free", "nut free", "no nuts", "nut allergy"],
    }
    
    found_dietary = set(collected.get("dietary_restrictions", []))
    for restriction, keywords in dietary_keywords.items():
        for kw in keywords:
            if kw in text_lower:
                found_dietary.add(restriction)
                break 
    if found_dietary:
        collected["dietary_restrictions"] = list(found_dietary)
    
    # 2. Extract cuisine preferences
    known_cuisines = [
        "italian", "japanese", "chinese", "indian", "mexican",
        "thai", "korean", "vietnamese", "mediterranean", "greek",
        "french", "american", "spanish", "middle eastern", "ethiopian"
    ]
    
    found_cuisines = set(c.lower() for c in collected.get("cuisine_preferences", []))
    for cuisine in known_cuisines:
        if cuisine in text_lower:
            found_cuisines.add(cuisine.title())
    if found_cuisines:
        collected["cuisine_preferences"] = list(found_cuisines)
    
    # 3. Extract budget
    import re
    budget_patterns = [
        r'\$\s*(\d{2,4})',
        r'(\d{2,4})\s*(?:dollars|bucks|usd)',
        r'budget\s*(?:is|of)?\s*(\d{2,4})'
    ]
    for pattern in budget_patterns:
        match = re.search(pattern, text_lower)
        if match:
            budget = int(match.group(1))
            collected["monthly_budget"] = budget
            break
            
    return collected

text = "vegetarian 500 month italian indian chinese thai"
print(f"Input: {text}")
result = parse_bulk_food_input(text)
print(f"Result: {result}")
