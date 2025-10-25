import json

def prepare_vectorize_format(input_json: str, output_ndjson: str) -> None:
    """Convert to Vectorize batch upload format (NDJSON)."""
    with open(input_json, 'r', encoding='utf-8') as f:
        signs = json.load(f)

    with open(output_ndjson, 'w', encoding='utf-8') as f:
        for sign in signs:
            if not sign.get("embedding"):
                continue

            # Vectorize format: id, values, metadata
            vectorize_entry = {
                "id": sign["id"],
                "values": sign["embedding"],
                "metadata": {
                    "glosa": sign["glosa"],
                    "definition": sign.get("definition", ""),
                    "translations": ",".join(sign.get("translations", [])),
                    "images": json.dumps(sign.get("images", [])),
                    "variant": sign.get("variant", 1)
                }
            }

            f.write(json.dumps(vectorize_entry) + '\n')

    print(f"Prepared {len(signs)} vectors for Vectorize upload")

if __name__ == '__main__':
    prepare_vectorize_format('output/signs_vectorized.json', 'output/vectorize_upload.ndjson')
