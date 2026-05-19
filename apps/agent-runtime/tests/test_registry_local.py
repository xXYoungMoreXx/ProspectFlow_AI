import sys
from pathlib import Path

# Add src to python path
src_path = str(Path(__file__).parent.parent / "src")
sys.path.insert(0, src_path)

from skills.registry import LocalFileSystemSkillRegistry

def test_registry():
    skills_dir = str(Path(__file__).parent.parent / "src" / "skills")
    registry = LocalFileSystemSkillRegistry(skills_dir)
    registry.discover_and_load()
    
    skills = registry.get_all_skills()
    print(f"Loaded {len(skills)} skills:")
    for skill in skills:
        print(f"- {skill.metadata.name} [{skill.metadata.slug}]")
        print(f"  Tool Class: {skill.tool.__class__.__name__}")
        print(f"  Tags: {skill.metadata.tags}")
        print(f"  Description: {skill.metadata.description}")
        print()

if __name__ == "__main__":
    test_registry()
