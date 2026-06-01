import importlib.util
import json
import os
from typing import Any

from crewai.tools import BaseTool


class SkillMetadata:
    def __init__(self, data: dict[str, Any]):
        self.slug = data.get("slug")
        self.name = data.get("name")
        self.description = data.get("description")
        self.category = data.get("category")
        self.tags = data.get("tags", [])
        self.supported_platforms = data.get("supported_platforms", [])
        self.entrypoint = data.get("entrypoint")
        self.version = data.get("version")


class Skill:
    def __init__(self, metadata: SkillMetadata, tool_instance: BaseTool):
        self.metadata = metadata
        self.tool = tool_instance


class LocalFileSystemSkillRegistry:
    """
    Registry that dynamically loads skills from the local file system.
    Scans the skills directory for skill.meta.json files and loads the corresponding python module.
    """

    def __init__(self, skills_dir: str):
        self.skills_dir = skills_dir
        self.skills: dict[str, Skill] = {}

    def discover_and_load(self):
        """Scans the directory and loads all valid skills."""
        if not os.path.exists(self.skills_dir):
            print(f"[SkillRegistry] Directory {self.skills_dir} does not exist.")
            return

        for entry in os.scandir(self.skills_dir):
            if entry.is_dir() and not entry.name.startswith("__"):
                meta_path = os.path.join(entry.path, "skill.meta.json")
                if os.path.exists(meta_path):
                    self._load_skill(entry.path, meta_path)

    def _load_skill(self, skill_path: str, meta_path: str):
        try:
            with open(meta_path, encoding="utf-8") as f:
                meta_data = json.load(f)

            metadata = SkillMetadata(meta_data)

            if not metadata.entrypoint:
                print(f"[SkillRegistry] Skipping {skill_path}: No entrypoint defined.")
                return

            # Entrypoint format: "module_name:ClassName" (e.g., "skill:CNPJLookupTool")
            module_name, class_name = metadata.entrypoint.split(":")
            module_path = os.path.join(skill_path, f"{module_name}.py")

            if not os.path.exists(module_path):
                print(f"[SkillRegistry] Skipping {skill_path}: Entrypoint module {module_path} not found.")
                return

            # Dynamically load the module
            spec = importlib.util.spec_from_file_location(module_name, module_path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)  # nosemgrep — controlled path, loaded from skills dir only

                # Get the tool class
                tool_class = getattr(module, class_name, None)
                if tool_class and issubclass(tool_class, BaseTool):
                    tool_instance = tool_class()
                    skill = Skill(metadata, tool_instance)
                    self.skills[metadata.slug] = skill
                    print(f"[SkillRegistry] Loaded skill: {metadata.name} ({metadata.slug})")
                else:
                    print(f"[SkillRegistry] Skipping {skill_path}: {class_name} is not a valid BaseTool.")

        except Exception as e:
            print(f"[SkillRegistry] Error loading skill from {skill_path}: {str(e)}")

    def get_skill(self, slug: str) -> Skill | None:
        return self.skills.get(slug)

    def get_all_skills(self) -> list[Skill]:
        return list(self.skills.values())

    def get_tools_for_platform(self, platform: str) -> list[BaseTool]:
        """Returns initialized BaseTool instances compatible with the given platform."""
        return [skill.tool for skill in self.skills.values() if platform in skill.metadata.supported_platforms]
