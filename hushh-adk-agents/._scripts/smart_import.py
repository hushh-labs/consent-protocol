import os
import shutil
import fnmatch

SOURCE_DIR = r"c:\OneDrive - NS\Repository\hushh-research\kushal-profile\repos"
TARGET_DIR = r"c:\OneDrive - NS\Repository\hushh-research\hushh-kai-demo\._kushal_profile_data\repos"

# Files to keep (Architecture/Config only)
KEEP_FILES = [
    'README*', 
    'package.json', 'package-lock.json',
    'requirements.txt', 'pyproject.toml', 'Pipfile*',
    'Dockerfile*', 'docker-compose*.yml',
    'tsconfig.json', 'jsconfig.json',
    'webpack.config.js', 'vite.config.*', 'next.config.*',
    '*.csproj', '*.sln', 'global.json',
    'pom.xml', 'build.gradle',
    'go.mod', 'go.sum',
    'Gemfile*',
    'Makefile',
    'vercel.json', 'netlify.toml',
    '.env.example'
]

# Max depth for tree generation
MAX_TREE_DEPTH = 3

def generate_tree(dir_path, prefix=""):
    """Generates a string representation of the directory tree."""
    output = ""
    try:
        entries = sorted(os.listdir(dir_path))
    except PermissionError:
        return ""

    entries = [e for e in entries if not e.startswith('.')]
    count = len(entries)
    
    for i, entry in enumerate(entries):
        connector = "└── " if i == count - 1 else "├── "
        output += f"{prefix}{connector}{entry}\n"
        
        full_path = os.path.join(dir_path, entry)
        if os.path.isdir(full_path):
            # Recurse if simple dir (not node_modules etc)
            if entry not in {'node_modules', 'bin', 'obj', 'dist', 'build', '__pycache__'}:
                # Basic depth limit check based on prefix length
                if len(prefix) < MAX_TREE_DEPTH * 4: 
                    extension = "    " if i == count - 1 else "│   "
                    output += generate_tree(full_path, prefix + extension)
    return output

def smart_import():
    print(f"Starting Smart Import from {SOURCE_DIR} to {TARGET_DIR}")
    
    if os.path.exists(TARGET_DIR):
        print("Cleaning target directory...")
        # We already cleaned it via shell, but just in case
        pass 
    else:
        os.makedirs(TARGET_DIR)

    # Iterate over top-level project folders in source
    for project_name in os.listdir(SOURCE_DIR):
        source_project_path = os.path.join(SOURCE_DIR, project_name)
        if not os.path.isdir(source_project_path):
            continue
            
        target_project_path = os.path.join(TARGET_DIR, project_name)
        os.makedirs(target_project_path, exist_ok=True)
        print(f"Processing project: {project_name}")

        # 1. Generate Tree
        tree_str = f"{project_name}/\n" + generate_tree(source_project_path)
        with open(os.path.join(target_project_path, 'project_structure.tree'), 'w', encoding='utf-8') as f:
            f.write(tree_str)
            
        # 2. Copy Config/Readme Files
        copied_count = 0
        for root, dirs, files in os.walk(source_project_path):
            # Exclude massive folders from traversal to speed up
            dirs[:] = [d for d in dirs if d not in {'node_modules', '.git', 'dist', 'build', 'bin', 'obj'}]
            
            for file in files:
                # Check if matches preserve patterns
                should_copy = False
                for pattern in KEEP_FILES:
                    if fnmatch.fnmatch(file, pattern):
                        should_copy = True
                        break
                
                if should_copy:
                    # Calculate relative path to maintain structure
                    rel_path = os.path.relpath(root, source_project_path)
                    target_subdir = os.path.join(target_project_path, rel_path)
                    os.makedirs(target_subdir, exist_ok=True)
                    
                    shutil.copy2(os.path.join(root, file), os.path.join(target_subdir, file))
                    copied_count += 1
        
        print(f"  -> Generated tree & copied {copied_count} config/readme files.")

    print("Smart Import Completed.")

if __name__ == "__main__":
    smart_import()
