"""
Cat Meme Matcher for Purrsonality.

This module maps classified facial expressions (from Step 9's rule-based
classifier) to corresponding cat-meme entries in a local structured dataset.
"""

from typing import Any, Dict, List, Optional

# ==============================================================================
# Cat Meme Dataset Configuration
# ==============================================================================

CAT_MEME_DATASET: List[Dict[str, str]] = [
    {
        "id": "cat_neutral",
        "expression": "Neutral",
        "cat_name": "Serious Cat",
        "image_path": "assets/memes/cat_neutral.jpg",
        "caption": "Just existing in stoic contemplation.",
    },
    {
        "id": "cat_happy",
        "expression": "Happy",
        "cat_name": "Happy Smug Cat",
        "image_path": "assets/memes/cat_happy.jpg",
        "caption": "Living my absolute best nine lives :3",
    },
    {
        "id": "cat_surprised",
        "expression": "Surprised",
        "cat_name": "Gasping Cat",
        "image_path": "assets/memes/cat_surprised.jpg",
        "caption": "Wait... you opened a can and it wasn't tuna?!",
    },
    {
        "id": "cat_eyes_closed",
        "expression": "Eyes Closed",
        "cat_name": "Zen Snoozing Cat",
        "image_path": "assets/memes/cat_eyes_closed.jpg",
        "caption": "Recharging purr batteries. Do not disturb.",
    },
]

# Dedicated fallback entry for when no human face is detected in frame
NO_FACE_CAT_ENTRY: Dict[str, str] = {
    "id": "cat_no_face",
    "expression": "No Face",
    "cat_name": "Searching Cat",
    "image_path": "assets/memes/cat_no_face.jpg",
    "caption": "Where did you go? Step in front of the camera, human!",
}

# Default fallback entry when an unrecognized or invalid expression is passed
DEFAULT_FALLBACK_ENTRY: Dict[str, str] = CAT_MEME_DATASET[0]  # Serious Cat (Neutral)

# Index the dataset by normalized (lowercase) expression name for fast lookup
_EXPRESSION_LOOKUP: Dict[str, Dict[str, str]] = {
    entry["expression"].strip().lower(): entry for entry in CAT_MEME_DATASET
}


# ==============================================================================
# Matching Function
# ==============================================================================

def match_cat(expression: Optional[str]) -> Dict[str, str]:
    """
    Maps a detected facial expression label to a corresponding cat meme.

    Parameters:
        expression (str or None): The expression state string returned by
            classify_expression() (e.g. 'Neutral', 'Happy', 'Surprised',
            'Eyes Closed', 'No Face', or None).

    Returns:
        dict: A structured cat-meme dictionary containing:
            - id (str): Unique identifier for the cat meme
            - expression (str): The mapped expression category
            - cat_name (str): Human-readable name of the cat
            - image_path (str): Relative path to the meme image asset
            - caption (str): Humorous cat caption matching the mood
    """
    if expression is None:
        return NO_FACE_CAT_ENTRY.copy()

    cleaned_expr = expression.strip().lower()

    # Handle No Face state
    if cleaned_expr in ("no face", "none", "unknown (no face)"):
        return NO_FACE_CAT_ENTRY.copy()

    # Exact match in expression lookup table
    if cleaned_expr in _EXPRESSION_LOOKUP:
        return _EXPRESSION_LOOKUP[cleaned_expr].copy()

    # Graceful fallback for unexpected expressions
    fallback = DEFAULT_FALLBACK_ENTRY.copy()
    return fallback


def get_all_cat_memes() -> List[Dict[str, str]]:
    """Returns a copy of the entire cat-meme dataset."""
    return [entry.copy() for entry in CAT_MEME_DATASET]


# ==============================================================================
# Self-Test Suite
# ==============================================================================

def run_tests() -> bool:
    """
    Executes automated test assertions across all standard expressions,
    edge cases, case variations, and fallbacks.
    """
    print("=" * 60)
    print("Running Cat Meme Matcher Test Suite")
    print("=" * 60)

    test_cases = [
        # Standard supported expressions
        ("Neutral", "cat_neutral", "Serious Cat"),
        ("Happy", "cat_happy", "Happy Smug Cat"),
        ("Surprised", "cat_surprised", "Gasping Cat"),
        ("Eyes Closed", "cat_eyes_closed", "Zen Snoozing Cat"),
        # Case variations
        ("happy", "cat_happy", "Happy Smug Cat"),
        ("SURPRISED", "cat_surprised", "Gasping Cat"),
        (" eyes closed ", "cat_eyes_closed", "Zen Snoozing Cat"),
        # No face handling
        ("No Face", "cat_no_face", "Searching Cat"),
        (None, "cat_no_face", "Searching Cat"),
        # Unrecognized / unknown expressions fallback
        ("Angry", "cat_neutral", "Serious Cat"),
        ("Confused", "cat_neutral", "Serious Cat"),
        ("RandomString123", "cat_neutral", "Serious Cat"),
    ]

    all_passed = True

    for input_expr, expected_id, expected_name in test_cases:
        result = match_cat(input_expr)
        matched_id = result.get("id")
        matched_name = result.get("cat_name")

        is_ok = (matched_id == expected_id) and (matched_name == expected_name)
        status_label = "PASS" if is_ok else "FAIL"

        print(
            f"[{status_label}] Input: {str(input_expr):<18} -> "
            f"ID: {matched_id:<16} Name: '{matched_name}'"
        )

        if not is_ok:
            all_passed = False
            print(f"      Expected ID: {expected_id}, Name: {expected_name}")

    print("=" * 60)
    if all_passed:
        print("All tests passed successfully!")
    else:
        print("Some tests failed!")
    print("=" * 60)

    return all_passed


if __name__ == "__main__":
    run_tests()
