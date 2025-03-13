import requests
import sys
import os
from spellchecker import SpellChecker

def check_spelling(text: str) -> tuple[str, list[str]]:
    spell = SpellChecker()
    words = text.split()
    misspelled = spell.unknown(words)
    
    if misspelled:
        print("\nPossible misspelled words found:")
        marked_text = text
        for word in misspelled:
            suggestions = list(spell.candidates(word) or [])[:3]
            print(f"- {word} (suggestions: {', '.join(suggestions)})")
            marked_text = marked_text.replace(word, f"*{word}*")
        return marked_text, list(misspelled)
    return text, []

def get_transformation_preferences():
    while True:
        transform_type = input("\nWould you like to:\n1. Simplify\n2. Sophisticate\nChoice (1/2): ")
        if transform_type in ["1", "2"]:
            break
        print("Please enter 1 or 2")
    
    while True:
        level = input("\nEnter level (1-5):\n1: Very simple/basic\n2: Somewhat simple\n3: Moderate\n4: Somewhat complex\n5: Very complex\nLevel: ")
        if level in ["1", "2", "3", "4", "5"]:
            break
        print("Please enter a number between 1 and 5")
    
    return "simplify" if transform_type == "1" else "sophisticate", int(level)

headers = {
    "Content-Type": "application/json",
    "X-API-Key": "clrty-sk-a7a6033a-ae82-4f25-ac37-0d1d023ca642"
}

# Get text from user
print("\nEnter the text you want to transform:")
original_text = input("> ")

# Check spelling
marked_text, misspelled_words = check_spelling(original_text)

# If there are misspelled words, ask user what to do
if misspelled_words:
    print("\nOriginal text with marked misspellings:")
    print(marked_text)
    choice = input("\nWould you like to: \n1. Proceed with original text\n2. Enter corrected text\nChoice (1/2): ")
    
    if choice == "2":
        new_text = input("\nEnter corrected text: ")
        transform_type, level = get_transformation_preferences()
        data = {
            "text": new_text,
            "transformationType": transform_type,
            "level": level
        }
    else:
        transform_type, level = get_transformation_preferences()
        data = {
            "text": original_text,
            "transformationType": transform_type,
            "level": level
        }
else:
    transform_type, level = get_transformation_preferences()
    data = {
        "text": original_text,
        "transformationType": transform_type,
        "level": level
    }

try:
    print("\nSending request to transform text...")
    response = requests.post("http://localhost:8000/transform", json=data, headers=headers)
    response.raise_for_status()  # Raise an exception for bad status codes
    result = response.json()
    
    print("\nOriginal text:")
    print(data["text"])
    print(f"\nTransformed text ({data['transformationType']}, level {data['level']}):")
    print(result.get("transformed_text"))
    print("\nRate limit info:")
    print(f"Requests remaining: {result.get('rate_limit', {}).get('requests_remaining')}")
    
    # Ask if user wants to transform another text
    another = input("\nWould you like to transform another text? (y/n): ")
    if another.lower() == 'y':
        print("\nRunning script again...")
        python = sys.executable
        os.execl(python, python, *sys.argv)
    
except requests.exceptions.ConnectionError:
    print("\nError: Could not connect to the server.")
    print("Please start the server first by running this command in a new terminal:")
    print("python start_server.py")
    sys.exit(1)
except requests.exceptions.RequestException as e:
    print(f"\nError: {str(e)}")
    sys.exit(1)
except Exception as e:
    print(f"\nUnexpected error: {str(e)}")
    sys.exit(1) 