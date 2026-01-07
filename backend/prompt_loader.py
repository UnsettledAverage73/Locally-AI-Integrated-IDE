import yaml
import os


class PromptRegistry:
    def __init__(self, prompt_dir="./prompts"):
        self.prompt_dir = os.path.join(os.path.dirname(__file__), prompt_dir)
        self.cache = {}

    def get_prompt(self, name, **kwargs):
        # Reloads from disk every time (great for testing without restarting server)
        file_path = os.path.join(self.prompt_dir, f"{name}.yaml")

        # simplified logic from user request to ensure it works
        with open(file_path, "r") as f:
            self.cache[name] = yaml.safe_load(f)

        template = self.cache[name]["template"]
        # Inject variables (e.g., {diff_content})
        return template.format(**kwargs)


prompt_registry = PromptRegistry()

