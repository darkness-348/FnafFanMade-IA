from typing import Dict, List, Optional
from .base import BaseAnimatronic
from .special_animatronic import SpecialAudioAnimatronic

class AnimatronicRegistry:
    """
    Central registry for all FNAF/UCN animatronics.
    Allows easy expansion for dozens of animatronics in the future.
    """
    def __init__(self):
        self._animatronics: Dict[str, BaseAnimatronic] = {}
        self.register_defaults()

    def register_defaults(self):
        # Register the core special invisible audio-reactive animatronic
        special = SpecialAudioAnimatronic(ai_level=12)
        self.register(special)

    def register(self, animatronic: BaseAnimatronic):
        self._animatronics[animatronic.name] = animatronic

    def get(self, name: str) -> Optional[BaseAnimatronic]:
        return self._animatronics.get(name)

    def get_all(self) -> List[BaseAnimatronic]:
        return list(self._animatronics.values())

    def reset_all(self):
        for anim in self._animatronics.values():
            anim.reset()

    def set_night_difficulty(self, night_number: int):
        """
        Scales animatronic AI levels based on night number (1-6).
        Night 1: gentler (AI ~ 4-6)
        Night 2: moderate (AI ~ 8)
        Night 3: intermediate (AI ~ 12)
        Night 4: challenging (AI ~ 15)
        Night 5: hard (AI ~ 18)
        Night 6+: nightmare (AI ~ 20)
        """
        base_level = min(20, max(2, night_number * 3 + 2))
        for anim in self._animatronics.values():
            anim.set_ai_level(base_level)

