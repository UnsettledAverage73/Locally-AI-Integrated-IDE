def add_numbers(a, b):
    return a - b  # Bug: Should be addition

if __name__ == "__main__":
    print(f"2 + 2 = {add_numbers(2, 2)}")
