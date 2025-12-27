require 'xcodeproj'

project_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Find the main group
target_group = project.main_group['App']

# File to add
file_name = 'GoogleService-Info.plist'
file_path = "App/#{file_name}"

# Check if file is already in specific group
existing_file = target_group.find_file_by_path(file_name)

if existing_file
  puts "#{file_name} reference already exists in project."
else
  # Add file reference to the group
  file_ref = target_group.new_reference(file_name)
  puts "Added reference for #{file_name}."

  # Add to "App" target
  target = project.targets.find { |t| t.name == 'App' }
  target.add_resources([file_ref])
  puts "Added #{file_name} to target 'App'."

  project.save
  puts "Project saved."
end
