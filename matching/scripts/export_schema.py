"""Regenerate matching/schema/*.schema.json from the models."""

from fime_matching.schema import write_schemas

if __name__ == "__main__":
    for path in write_schemas():
        print("wrote", path)
