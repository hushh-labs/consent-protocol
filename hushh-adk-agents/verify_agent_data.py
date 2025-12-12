import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

try:
    from kushal_agent import KUSHAL_PROFILE_DATA
    print(f"SUCCESS: Agent data loaded.")
    print(f"Total Character Count: {len(KUSHAL_PROFILE_DATA)}")
    
    # Check for tree content
    if "project_structure.tree" in KUSHAL_PROFILE_DATA:
         print("SUCCESS: Found 'project_structure.tree' in data.")
    else:
         print("WARNING: 'project_structure.tree' NOT found in data.")

    # Check for config files
    if "package.json" in KUSHAL_PROFILE_DATA:
        print("SUCCESS: Found 'package.json' in data.")
    
    # Size check (should be much smaller now)
    size_mb = len(KUSHAL_PROFILE_DATA) / 1024 / 1024
    print(f"Context Size: {size_mb:.2f} MB")
    
    if size_mb > 5:
        print("WARNING: Context size > 5MB. Is the filtering working?")
    else:
        print("SUCCESS: Context size within Blueprint limits (<5MB).")

except Exception as e:
    print(f"FAILURE: {e}")
