def fib(n):
    if n <= 1:
        return n
    # BUG: This should be fib(n-1) + fib(n-2)
    return fib(n-1) + 1 

if __name__ == "__main__":
    import sys
    val = int(sys.argv[1])
    print(fib(val))
