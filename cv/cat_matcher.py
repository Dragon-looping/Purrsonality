"""
Cat Meme Matcher for Purrsonality.

This module maps classified facial expressions (from Step 9's rule-based
classifier) to real local cat-meme images discovered dynamically from the
filesystem under the memes asset directory.
"""

import os
import random
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

# Project root directory for relative path resolution
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Supported image file extensions (case-insensitive)
SUPPORTED_EXTENSIONS: Set[str] = {".jpg", ".jpeg", ".png", ".webp"}

# Mapping of normalized expression names to folder names
EXPRESSION_FOLDER_MAP: Dict[str, str] = {
    "neutral": "neutral",
    "happy": "happy",
    "surprised": "surprised",
    "eyes closed": "eyes_closed",
}

# Metadata templates for each expression category
EXPRESSION_METADATA: Dict[str, Dict[str, str]] = {
    "neutral": {
        "id": "cat_neutral",
        "expression": "Neutral",
        "cat_name": "Serious Cat",
        "caption": "Just existing in stoic contemplation.",
    },
    "happy": {
        "id": "cat_happy",
        "expression": "Happy",
        "cat_name": "Happy Smug Cat",
        "caption": "Living my absolute best nine lives :3",
    },
    "surprised": {
        "id": "cat_surprised",
        "expression": "Surprised",
        "cat_name": "Gasping Cat",
        "caption": "Wait... you opened a can and it wasn't tuna?!",
    },
    "eyes closed": {
        "id": "cat_eyes_closed",
        "expression": "Eyes Closed",
        "cat_name": "Zen Snoozing Cat",
        "caption": "Recharging purr batteries. Do not disturb.",
    },
}

# Fallback entry for when no face is detected
NO_FACE_CAT_ENTRY: Dict[str, Any] = {
    "id": "cat_no_face",
    "expression": "No Face",
    "cat_name": "Searching Cat",
    "image_path": None,
    "caption": "Where did you go? Step in front of the camera, human!",
}


def get_memes_base_dir() -> Path:
    """
    Locates the memes root directory relative to the project root.
    Gracefully supports standard 'assets/memes' as well as common typos
    (such as 'assests/memes').
    """
    for candidate in ["assets/memes", "assests/memes"]:
        dir_path = PROJECT_ROOT / candidate
        if dir_path.exists() and dir_path.is_dir():
            return dir_path
    return PROJECT_ROOT / "assets" / "memes"


def discover_cat_images(category: str, base_dir: Optional[Path] = None) -> List[Path]:
    """
    Discovers all valid image files for a given expression category folder.

    Parameters:
        category (str): The folder key (e.g. 'neutral', 'happy', 'surprised', 'eyes_closed').
        base_dir (Path, optional): Base directory containing expression subfolders.

    Returns:
        List[Path]: Sorted list of Path objects for all matching image files.
    """
    if base_dir is None:
        base_dir = get_memes_base_dir()

    folder_name = EXPRESSION_FOLDER_MAP.get(category.strip().lower(), category.strip().lower())
    target_dir = base_dir / folder_name

    if not target_dir.exists() or not target_dir.is_dir():
        return []

    images = [
        f for f in target_dir.iterdir()
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    return sorted(images)


def get_category_inventory(base_dir: Optional[Path] = None) -> Dict[str, List[Path]]:
    """
    Returns an inventory of discovered images for all four expression categories.
    """
    if base_dir is None:
        base_dir = get_memes_base_dir()

    inventory: Dict[str, List[Path]] = {}
    for expr_key in EXPRESSION_FOLDER_MAP:
        inventory[expr_key] = discover_cat_images(expr_key, base_dir=base_dir)
    return inventory


def match_cat(expression: Optional[str], base_dir: Optional[Path] = None) -> Dict[str, Any]:
    """
    Maps a detected facial expression label to a randomly selected real cat-meme image.

    Parameters:
        expression (str or None): The expression label returned by classify_expression()
            ('Neutral', 'Happy', 'Surprised', 'Eyes Closed', 'No Face', or None).
        base_dir (Path, optional): Base memes directory.

    Returns:
        dict: A structured cat-meme dictionary containing:
            - id (str): Unique identifier
            - expression (str): Mapped expression category name
            - cat_name (str): Human-readable name of the cat
            - image_path (str or None): Relative path to the selected image file
            - caption (str): Cat meme caption
    """
    if base_dir is None:
        base_dir = get_memes_base_dir()

    # Handle No Face or empty input
    if expression is None:
        return NO_FACE_CAT_ENTRY.copy()

    cleaned_expr = expression.strip().lower()

    if cleaned_expr in ("no face", "none", "unknown (no face)"):
        return NO_FACE_CAT_ENTRY.copy()

    # Determine matched category or fallback to neutral
    if cleaned_expr in EXPRESSION_FOLDER_MAP:
        category_key = cleaned_expr
    else:
        # Fallback for unrecognized expression strings
        category_key = "neutral"

    metadata = EXPRESSION_METADATA[category_key].copy()

    # Discover available images in the category folder
    available_images = discover_cat_images(category_key, base_dir=base_dir)

    if available_images:
        # Randomly select one available image
        selected_image = random.choice(available_images)
        try:
            # Produce a clean relative path from the project root
            rel_path = selected_image.relative_to(PROJECT_ROOT).as_posix()
        except ValueError:
            rel_path = selected_image.as_posix()

        metadata["image_path"] = rel_path
        # Append image stem to id for uniqueness
        metadata["id"] = f"{metadata['id']}_{selected_image.stem}"
    else:
        # Graceful handling for missing or empty folders
        metadata["image_path"] = None
        metadata["caption"] = f"{metadata['caption']} [Note: No image found in {category_key}/]"

    return metadata


# ==============================================================================
# Self-Test Suite
# ==============================================================================

def run_tests() -> bool:
    """
    Executes automated test assertions across all expressions with real local images,
    supported formats, fallback scenarios, and empty folder edge cases.
    """
    base_dir = get_memes_base_dir()
    print("=" * 70)
    print(f"Cat Meme Matcher Test Suite (Base Dir: {base_dir})")
    print("=" * 70)

    # 1. Inventory Check
    inventory = get_category_inventory(base_dir)
    print("\n--- Discovered Image Inventory ---")
    total_images = 0
    for cat_name, file_list in inventory.items():
        print(f"  [{cat_name.title():<12}]: {len(file_list)} image(s)")
        for img in file_list:
            print(f"      - {img.name} ({img.suffix.lower()})")
        total_images += len(file_list)
    print(f"Total Discovered Images: {total_images}\n")

    # 2. Expression Matching Tests with Real Files
    print("--- Expression Matching Tests ---")
    test_expressions = ["Neutral", "Happy", "Surprised", "Eyes Closed"]
    all_passed = True

    for expr in test_expressions:
        cat = match_cat(expr, base_dir=base_dir)
        has_image = cat["image_path"] is not None
        file_exists = (PROJECT_ROOT / cat["image_path"]).exists() if has_image else False

        status = "PASS" if (has_image and file_exists) else "FAIL"
        if not (has_image and file_exists):
            all_passed = False

        print(f"[{status}] Expression: '{expr}'")
        print(f"       -> ID:         {cat['id']}")
        print(f"       -> Cat Name:   {cat['cat_name']}")
        print(f"       -> Selected:   {cat['image_path']}")
        print(f"       -> Caption:    \"{cat['caption']}\"")
        print(f"       -> File Valid: {file_exists}")

    # 3. Format Recognition Test
    print("\n--- Format Recognition Test ---")
    discovered_extensions = {img.suffix.lower() for files in inventory.values() for img in files}
    print(f"Supported Extensions Configured: {sorted(list(SUPPORTED_EXTENSIONS))}")
    print(f"Extensions Found in Folders:     {sorted(list(discovered_extensions))}")
    extensions_ok = discovered_extensions.issubset(SUPPORTED_EXTENSIONS)
    print(f"[{'PASS' if extensions_ok else 'FAIL'}] All discovered files match supported extensions.")
    if not extensions_ok:
        all_passed = False

    # 4. Fallback Tests
    print("\n--- Edge Case & Fallback Tests ---")
    # Test No Face
    no_face_res = match_cat("No Face", base_dir=base_dir)
    no_face_ok = (no_face_res["id"] == "cat_no_face") and (no_face_res["expression"] == "No Face")
    print(f"[{'PASS' if no_face_ok else 'FAIL'}] 'No Face' input handled gracefully -> {no_face_res['cat_name']}")
    if not no_face_ok:
        all_passed = False

    # Test None
    none_res = match_cat(None, base_dir=base_dir)
    none_ok = (none_res["id"] == "cat_no_face")
    print(f"[{'PASS' if none_ok else 'FAIL'}] None input handled gracefully -> {none_res['cat_name']}")
    if not none_ok:
        all_passed = False

    # Test Unknown Expression Fallback
    unknown_res = match_cat("EnragedAlienCat", base_dir=base_dir)
    unknown_ok = (unknown_res["expression"] == "Neutral") and (unknown_res["image_path"] is not None)
    print(f"[{'PASS' if unknown_ok else 'FAIL'}] Unknown expression ('EnragedAlienCat') fell back to Neutral -> {unknown_res['image_path']}")
    if not unknown_ok:
        all_passed = False

    # Test Non-existent / Empty Folder (must not crash)
    dummy_empty_dir = PROJECT_ROOT / "temp_dummy_nonexistent_dir"
    empty_res = match_cat("Happy", base_dir=dummy_empty_dir)
    empty_ok = (empty_res["expression"] == "Happy") and (empty_res["image_path"] is None)
    print(f"[{'PASS' if empty_ok else 'FAIL'}] Missing/empty folder handled safely without crash -> image_path={empty_res['image_path']}")
    if not empty_ok:
        all_passed = False

    print("\n" + "=" * 70)
    print(f"Summary: {'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}")
    print("=" * 70)

    return all_passed


if __name__ == "__main__":
    run_tests()
