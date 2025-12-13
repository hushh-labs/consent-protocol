# Food & Dining API - Data Schema

> **Domain:** Personal food preferences, dietary needs, and dining history
> **Purpose:** Enable consent-based sharing of food data for personalized recommendations

---

## 1. User Dietary Profile

Core dietary information that defines a user's food identity.

### `DietaryProfile`

| Field                | Type         | Required | Description                      |
| -------------------- | ------------ | -------- | -------------------------------- |
| `user_id`            | string       | ✅       | Unique user identifier           |
| `diet_type`          | enum         | ✅       | Primary diet classification      |
| `allergies`          | string[]     | ❌       | Food allergies                   |
| `intolerances`       | string[]     | ❌       | Food intolerances (non-allergic) |
| `restrictions`       | string[]     | ❌       | Religious/ethical restrictions   |
| `medical_conditions` | string[]     | ❌       | Diet-affecting conditions        |
| `calorie_target`     | number       | ❌       | Daily calorie goal               |
| `macro_targets`      | MacroTargets | ❌       | Macronutrient goals              |
| `updated_at`         | timestamp    | ✅       | Last update time                 |

### `diet_type` Enum Values

```
vegetarian, vegan, pescatarian, keto, paleo,
mediterranean, gluten_free, dairy_free, halal,
kosher, none, custom
```

### `MacroTargets`

| Field       | Type   | Description                 |
| ----------- | ------ | --------------------------- |
| `protein_g` | number | Daily protein (grams)       |
| `carbs_g`   | number | Daily carbohydrates (grams) |
| `fat_g`     | number | Daily fat (grams)           |
| `fiber_g`   | number | Daily fiber (grams)         |

---

## 2. Food Preferences

What the user likes and dislikes about food.

### `FoodPreferences`

| Field                  | Type       | Required | Description                   |
| ---------------------- | ---------- | -------- | ----------------------------- |
| `user_id`              | string     | ✅       | Unique user identifier        |
| `favorite_cuisines`    | string[]   | ❌       | Preferred cuisine types       |
| `disliked_cuisines`    | string[]   | ❌       | Avoided cuisines              |
| `favorite_ingredients` | string[]   | ❌       | Loved ingredients             |
| `disliked_ingredients` | string[]   | ❌       | Avoided ingredients           |
| `spice_tolerance`      | enum       | ❌       | Spice level preference        |
| `sweetness_preference` | enum       | ❌       | Sweet preference              |
| `portion_preference`   | enum       | ❌       | Portion size                  |
| `meal_timing`          | MealTiming | ❌       | Typical meal times            |
| `cooking_skill`        | enum       | ❌       | Self-assessed cooking ability |

### `cuisine_type` Values

```
italian, mexican, chinese, japanese, indian, thai,
french, mediterranean, american, korean, vietnamese,
greek, spanish, middle_eastern, ethiopian, caribbean,
soul_food, fusion, farm_to_table, fast_food
```

### `spice_tolerance` Enum

```
none, mild, medium, hot, extra_hot
```

### `MealTiming`

| Field            | Type   | Description            |
| ---------------- | ------ | ---------------------- |
| `breakfast_time` | time   | Typical breakfast time |
| `lunch_time`     | time   | Typical lunch time     |
| `dinner_time`    | time   | Typical dinner time    |
| `snack_times`    | time[] | Typical snack times    |

---

## 3. Restaurant Preferences

Where and how the user prefers to dine.

### `RestaurantPreferences`

| Field                     | Type         | Required | Description                      |
| ------------------------- | ------------ | -------- | -------------------------------- |
| `user_id`                 | string       | ✅       | Unique user identifier           |
| `price_range`             | enum         | ❌       | Budget preference                |
| `ambiance_preferences`    | string[]     | ❌       | Preferred dining atmosphere      |
| `service_preferences`     | string[]     | ❌       | Service style preferences        |
| `location_radius_km`      | number       | ❌       | Max distance for recommendations |
| `favorite_restaurants`    | Restaurant[] | ❌       | Saved favorites                  |
| `blacklisted_restaurants` | string[]     | ❌       | Places to avoid                  |

### `price_range` Enum

```
budget ($), moderate ($$), upscale ($$$), fine_dining ($$$$)
```

### `ambiance_preferences` Values

```
casual, romantic, family_friendly, quiet, lively,
outdoor, rooftop, waterfront, trendy, traditional
```

### `Restaurant`

| Field           | Type     | Description                  |
| --------------- | -------- | ---------------------------- |
| `restaurant_id` | string   | Unique restaurant ID         |
| `name`          | string   | Restaurant name              |
| `cuisine`       | string   | Primary cuisine              |
| `location`      | Location | Address/coordinates          |
| `rating`        | number   | User's personal rating (1-5) |
| `notes`         | string   | Personal notes               |

---

## 4. Dining History

Record of past dining experiences.

### `DiningEvent`

| Field           | Type       | Required | Description                  |
| --------------- | ---------- | -------- | ---------------------------- |
| `event_id`      | string     | ✅       | Unique event identifier      |
| `user_id`       | string     | ✅       | User identifier              |
| `restaurant_id` | string     | ❌       | Restaurant (if dining out)   |
| `event_type`    | enum       | ✅       | Type of dining event         |
| `date`          | date       | ✅       | Date of event                |
| `meal_type`     | enum       | ✅       | Breakfast/lunch/dinner/snack |
| `items_ordered` | MenuItem[] | ❌       | What was consumed            |
| `total_spent`   | Money      | ❌       | Amount spent                 |
| `party_size`    | number     | ❌       | Number of people             |
| `occasion`      | string     | ❌       | Special occasion             |
| `rating`        | number     | ❌       | Experience rating (1-5)      |
| `photos`        | string[]   | ❌       | Photo URLs                   |
| `notes`         | string     | ❌       | Personal notes               |

### `event_type` Enum

```
dine_in, takeout, delivery, home_cooked, catered, food_truck
```

### `MenuItem`

| Field      | Type    | Description                    |
| ---------- | ------- | ------------------------------ |
| `name`     | string  | Item name                      |
| `category` | string  | Appetizer, main, dessert, etc. |
| `price`    | number  | Item price                     |
| `rating`   | number  | Personal rating (1-5)          |
| `reorder`  | boolean | Would order again              |

### `Money`

| Field      | Type   | Description                    |
| ---------- | ------ | ------------------------------ |
| `amount`   | number | Numeric amount                 |
| `currency` | string | Currency code (USD, EUR, etc.) |

---

## 5. Meal Plans & Goals

User's meal planning and dietary goals.

### `MealPlan`

| Field        | Type          | Required | Description                    |
| ------------ | ------------- | -------- | ------------------------------ |
| `plan_id`    | string        | ✅       | Plan identifier                |
| `user_id`    | string        | ✅       | User identifier                |
| `name`       | string        | ✅       | Plan name                      |
| `goal`       | enum          | ❌       | Weight loss, muscle gain, etc. |
| `start_date` | date          | ❌       | Plan start date                |
| `end_date`   | date          | ❌       | Plan end date                  |
| `meals`      | PlannedMeal[] | ❌       | Scheduled meals                |

### `goal` Enum

```
weight_loss, muscle_gain, maintenance, health_improvement,
budget_saving, exploration, none
```

### `PlannedMeal`

| Field           | Type    | Description             |
| --------------- | ------- | ----------------------- |
| `date`          | date    | Planned date            |
| `meal_type`     | enum    | Breakfast/lunch/dinner  |
| `recipe_id`     | string  | Reference to recipe     |
| `restaurant_id` | string  | Or restaurant reference |
| `completed`     | boolean | Was it followed         |

---

## 6. Grocery & Ingredients

User's ingredient inventory and shopping preferences.

### `GroceryPreferences`

| Field                 | Type     | Required | Description              |
| --------------------- | -------- | -------- | ------------------------ |
| `user_id`             | string   | ✅       | User identifier          |
| `preferred_stores`    | string[] | ❌       | Favorite grocery stores  |
| `organic_preference`  | enum     | ❌       | Organic preference level |
| `budget_weekly`       | Money    | ❌       | Weekly grocery budget    |
| `shopping_day`        | string   | ❌       | Preferred shopping day   |
| `delivery_preference` | boolean  | ❌       | Prefers delivery         |

### `Pantry`

| Field     | Type         | Required | Description       |
| --------- | ------------ | -------- | ----------------- |
| `user_id` | string       | ✅       | User identifier   |
| `items`   | PantryItem[] | ❌       | Current inventory |

### `PantryItem`

| Field         | Type   | Description             |
| ------------- | ------ | ----------------------- |
| `ingredient`  | string | Ingredient name         |
| `quantity`    | string | Amount (e.g., "2 lbs")  |
| `expiry_date` | date   | Expiration date         |
| `location`    | string | Fridge, freezer, pantry |

---

## Consent Scopes

| Scope                   | Access Level | Description                   |
| ----------------------- | ------------ | ----------------------------- |
| `food.read.profile`     | Read         | Dietary profile & preferences |
| `food.read.history`     | Read         | Dining history                |
| `food.read.restaurants` | Read         | Restaurant preferences        |
| `food.read.plans`       | Read         | Meal plans                    |
| `food.read.grocery`     | Read         | Grocery preferences & pantry  |
| `food.write.profile`    | Write        | Update dietary profile        |
| `food.write.history`    | Write        | Add dining events             |

---

## API Endpoints (Planned)

| Method | Endpoint                | Scope                   | Description                |
| ------ | ----------------------- | ----------------------- | -------------------------- |
| GET    | `/api/food/profile`     | `food.read.profile`     | Get dietary profile        |
| PUT    | `/api/food/profile`     | `food.write.profile`    | Update dietary profile     |
| GET    | `/api/food/preferences` | `food.read.profile`     | Get food preferences       |
| GET    | `/api/food/restaurants` | `food.read.restaurants` | Get restaurant preferences |
| GET    | `/api/food/history`     | `food.read.history`     | Get dining history         |
| POST   | `/api/food/history`     | `food.write.history`    | Add dining event           |
| GET    | `/api/food/plans`       | `food.read.plans`       | Get meal plans             |
