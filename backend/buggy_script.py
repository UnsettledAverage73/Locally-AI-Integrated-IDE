def fibonacci(n):
    if n <= 1:
        return n
    else:
        a, b = 0, 1
        while a < n:
            a, b = b, a + b
        return b

# Get user input for the number of terms in the Fibonacci sequence
n_terms = int(input("Enter the number of terms you want to generate: "))const { WebRTPSender } = require('web-rtsp');

// ...

var sender = new WebRTPSender({ host: 'your_host', port: 8080, streamName: 'video' });
sender.on('error', function () {
  console.log("Error");
});

// ...


# Generate and print the Fibonacci sequence
print(f"Fibonacci series up to {n_terms} terms:")
for i in range(n_terms):
    print(f"Term {i + 1}: {fibonacci(i)}")