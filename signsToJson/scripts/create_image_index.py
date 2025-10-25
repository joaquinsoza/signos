import json
from pathlib import Path
import sys

def create_image_index(images_dir: str, output_json: str) -> None:
    """Map glosa -> image paths for Tauri client."""
    images_path = Path(images_dir)

    index = {}
    for img_file in images_path.rglob("*.jpeg"):
        # Format: GLOSA_variant_sequence.jpeg (in subdirectories by letter)
        parts = img_file.stem.split('_')
        if len(parts) >= 2:
            # Get glosa (everything except last 2 parts which are variant and sequence)
            glosa = '_'.join(parts[:-1])
            sequence = parts[-1]

            # Get the letter directory and filename for path
            letter_dir = img_file.parent.name

            key = glosa
            if key not in index:
                index[key] = []

            index[key].append(f"/signs/{letter_dir}/{img_file.name}")

    # Sort images by sequence within each glosa
    for key in index:
        index[key].sort()

    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=2, ensure_ascii=False)

    print(f"Indexed {len(index)} sign variants with {sum(len(v) for v in index.values())} total images")

if __name__ == '__main__':
    create_image_index(
        '/app/output/images',
        '/app/output/image_index.json'
    )
