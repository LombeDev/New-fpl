document.addEventListener('DOMContentLoaded', () => {
    // Get a reference to the button element
    const continueButton = document.getElementById('continue-button');
    
    // Define the target URL
    const REDIRECT_URL = 'main.html';
    
    // Define the function that performs the instant navigation
    const instantRedirect = () => {
        // This line immediately navigates the browser to 'main.html'
        window.location.href = REDIRECT_URL;
    };

    // Attach the instantRedirect function to the button's click event
    continueButton.addEventListener('click', instantRedirect);

    // Optional: Attach the same function to the Enter key press on the input field
    const inputField = document.getElementById('answer-input');
    inputField.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Stop the default 'Enter' behavior
            instantRedirect();
        }
    });

    // Since we are instantly redirecting, you can remove the feedback-related lines 
    // and hidden class from your quiz.css if you don't need them anymore.
});