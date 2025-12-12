# Resume Generation System - Usage Guide

Complete guide for using the automated ATS-optimized resume generation system.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Editing Resume Data](#editing-resume-data)
3. [Generating Resume](#generating-resume)
4. [Validation](#validation)
5. [Cursor Integration](#cursor-integration)
6. [Advanced Usage](#advanced-usage)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Installation

```bash
# Install dependencies
pip install -r requirements.txt
```

### Generate Your First Resume

```bash
# From project root directory
python scripts/generate_resume.py
```

Your resume will be generated at: `output/Resume_Kushal_Latest.docx`

---

## Editing Resume Data

All resume content is stored in YAML files in the `data/` directory. Edit these files to update your resume.

### Profile Information (`data/profile.yaml`)

```yaml
personal:
  name: "Your Name"
  title: "Your Professional Title"
  location: "City, State"
  phone: "+1 XXX-XXX-XXXX"
  email: "your.email@example.com"
  linkedin: "linkedin.com/in/yourprofile"
  github: "github.com/yourusername"
  portfolio: "yourwebsite.com"
```

### Key Achievements (`data/achievements.yaml`)

```yaml
key_achievements:
  - achievement: "Brief achievement title"
    details: "detailed description with metrics"
```

**Tips:**
- Start with strong action verbs
- Include quantifiable metrics
- Keep each achievement to 1-2 lines

### Professional Experience (`data/experience.yaml`)

```yaml
professional_experience:
  - company: "Company Name"
    location: "City, Country"
    title: "Your Title"
    start_date: "Month YYYY"
    end_date: "Month YYYY" # or "Present"
    responsibilities:
      - "Bullet point 1 with metrics"
      - "Bullet point 2 with achievements"
```

**Tips:**
- Use action verbs (Architected, Built, Led, etc.)
- Quantify impact (X% improvement, Y users, $Z savings)
- Focus on achievements, not just duties

### Current Projects (`data/projects.yaml`)

```yaml
current_projects:
  - name: "Project Name"
    role: "Your Role"
    status: "Alpha/Beta/Production"
    url: "https://project-url.com"
    metrics: "Key metric (e.g., 250+ users)"
    description:
      - "Achievement or feature 1"
      - "Achievement or feature 2"
    tech_stack: "Tech1, Tech2, Tech3"
```

**Tips for AI/ML Projects:**
- Use "Founding Engineer" for early-stage roles
- Phrase as "Built" or "Architected" (not "Researched")
- Include "AI-assisted development" if using Cursor
- Quantify model accuracy, data size, etc.

### Technical Skills (`data/skills.yaml`)

```yaml
technical_skills:
  category_name:
    category: "Display Name"
    skills:
      - "Skill 1"
      - "Skill 2"
```

**Categories to include:**
- AI & Machine Learning
- Frontend Development
- Backend Development
- Databases & ORM
- Cloud & DevOps
- Authentication & Security
- Compliance & Standards
- Development Tools

### Education (`data/education.yaml`)

```yaml
education:
  - institution: "University Name"
    location: "City, State"
    degree: "Degree Name, Major"
    start_date: "Month YYYY"
    end_date: "Month YYYY"

certifications:
  - name: "Certification Name"
    description: "Brief description"
```

---

## Generating Resume

### Command Line

```bash
python scripts/generate_resume.py
```

### What Happens:

1. **Reads Data**: Loads all YAML files from `data/`
2. **Generates Document**: Creates ATS-compliant .docx
3. **Saves Output**: 
   - Latest: `output/Resume_Kushal_Latest.docx`
   - Backup: `output/versions/Resume_Kushal_YYYYMMDD_HHMMSS.docx`
4. **Validates**: Runs ATS compliance checks
5. **Reports**: Displays validation results

### Output Example:

```
======================================================================
RESUME GENERATION SYSTEM
======================================================================

[*] Generating resume from YAML data...
[+] Resume generated successfully: output/Resume_Kushal_Latest.docx
[+] Versioned copy saved: output/versions/Resume_Kushal_20241112_143022.docx

[*] Validating ATS compliance...

======================================================================
ATS COMPLIANCE VALIDATION REPORT
======================================================================

File: output\Resume_Kushal_Latest.docx
Score: 9/9
Status: [+] COMPLIANT

Passed Checks:      
----------------------------------------------------------------------
  [PASS] File format is .docx (recommended)
  [PASS] All fonts are ATS-compliant
  [PASS] Font sizes are within acceptable ranges
  ...

[+] Resume is ATS-compliant and ready to use!
```

---

## Validation

### Standalone Validation

To validate an existing resume:

```bash
python scripts/validate_ats.py path/to/resume.docx
```

### Validation Checks

The validator checks:

1. **File Format**: Must be .docx
2. **Fonts**: Only Calibri, Arial, Georgia, Helvetica
3. **Font Sizes**: 10-12pt body, 14-18pt headers
4. **Text Boxes**: None allowed
5. **Tables**: None recommended
6. **Layout**: Single column
7. **Headers/Footers**: No content
8. **Bullet Points**: Standard bullets only
9. **Sections**: All required sections present

### Reading Validation Reports

- **[PASS]**: Check passed
- **[!] Warning**: Non-critical issue
- **[-] Error**: Critical issue requiring fix

---

## Cursor Integration

### Using .cursorrules

The system includes `.cursorrules` for Cursor IDE automation.

### Natural Language Commands:

**"update resume"**
- Reads YAML files
- Generates new resume
- Validates ATS compliance
- Shows results

**"validate resume"**
- Checks existing resume
- Displays validation report

**"edit profile"**
- Opens `data/profile.yaml` for editing

### Example Workflow in Cursor:

1. Say: "update resume with my new project"
2. Cursor opens `data/projects.yaml`
3. Add your project details
4. Say: "update resume"
5. Cursor generates and validates

---

## Advanced Usage

### Custom Formatting

Edit `generators/docx_generator.py`:

```python
def _setup_styles(self, doc: Document):
    """Customize styles here"""
    normal = styles['Normal']
    normal_font.size = Pt(11)  # Change size
    normal_font.name = 'Arial'  # Change font
```

### Adding New Sections

1. **Add data to YAML**:
```yaml
# data/custom.yaml
custom_section:
  - item: "Custom item"
    details: "Details"
```

2. **Add processor method**:
```python
# generators/content_processor.py
def get_custom_data(self):
    data = self.load_yaml_file('custom.yaml')
    return data.get('custom_section', [])
```

3. **Add generator method**:
```python
# generators/docx_generator.py
def add_custom_section(self, data):
    self.add_section_header("CUSTOM SECTION")
    for item in data:
        # Add content
        pass
```

4. **Include in generation**:
```python
# generators/docx_generator.py - generate() method
custom = self.processor.get_custom_data()
self.add_custom_section(custom)
```

### Multiple Resume Templates

Create different generation scripts for different roles:

```bash
# Copy and modify
cp scripts/generate_resume.py scripts/generate_resume_ml.py
# Edit to emphasize AI/ML experience

cp scripts/generate_resume.py scripts/generate_resume_fullstack.py
# Edit to emphasize full-stack experience
```

### Batch Generation

Generate multiple versions:

```python
# scripts/batch_generate.py
from generators.docx_generator import ATSResumeGenerator

roles = ['ml_engineer', 'full_stack', 'cloud_engineer']

for role in roles:
    generator = ATSResumeGenerator()
    generator.generate(f"output/Resume_Kushal_{role}.docx")
```

---

## Troubleshooting

### Issue: "No module named 'docx'"

**Solution:**
```bash
pip install python-docx PyYAML python-dateutil
```

### Issue: "FileNotFoundError: data/profile.yaml"

**Solution:**
- Ensure you're in project root directory
- Check that `data/` folder exists
- Verify YAML files are present

### Issue: "UnicodeEncodeError"

**Solution:**
- Already fixed in current version
- If persists, update Python to 3.8+

### Issue: Resume looks wrong in Word

**Solution:**
- Check YAML indentation (2 spaces)
- Validate YAML syntax: https://www.yamllint.com/
- Regenerate after fixing YAML

### Issue: Validation fails

**Solution:**
1. Review validation report
2. Check which checks failed
3. Fix YAML data or generator code
4. Regenerate and validate again

### Issue: Formatting doesn't match expectations

**Solution:**
- Edit `generators/docx_generator.py`
- Modify `_setup_styles()` method
- Adjust font sizes, spacing, etc.
- Regenerate

---

## Best Practices

### 1. Data Management
- Keep YAML files as single source of truth
- Use version control (Git) for YAML files
- Create backups before major changes

### 2. Generation Workflow
- Edit YAML → Generate → Validate → Review
- Always validate before using
- Keep versioned copies for rollback

### 3. Content Writing
- Use action verbs
- Quantify achievements
- Tailor to job description
- Keep consistent tense
- Avoid acronyms without explanation

### 4. AI/ML Positioning
- Use "Founding Engineer" for early roles
- Say "Built" not "Researched"
- Mention "AI-assisted development" when true
- Focus on systems engineering
- Quantify model performance

### 5. ATS Optimization
- Match job description keywords
- Use standard section names
- Keep single column layout
- Avoid graphics and images
- Save as .docx, not PDF

---

## Quick Reference

### Common Commands

```bash
# Generate resume
python scripts/generate_resume.py

# Validate resume
python scripts/validate_ats.py output/Resume_Kushal_Latest.docx

# Check Python version
python --version

# Install dependencies
pip install -r requirements.txt

# Update dependencies
pip install --upgrade python-docx PyYAML
```

### File Locations

- **YAML Data**: `data/*.yaml`
- **Generated Resume**: `output/Resume_Kushal_Latest.docx`
- **Backups**: `output/versions/`
- **Generator Code**: `generators/docx_generator.py`
- **Validation Code**: `generators/ats_validator.py`

### Key Concepts

- **ATS**: Applicant Tracking System
- **YAML**: Human-readable data format
- **.docx**: Microsoft Word document format (ATS-friendly)
- **Validation**: Checking ATS compliance

---

## Getting Help

If you encounter issues:

1. Check this usage guide
2. Review `docs/ATS_BEST_PRACTICES.md`
3. Check validation report for specific errors
4. Review YAML syntax
5. Verify Python dependencies installed

---

**Happy Resume Generating!** 🚀

