document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Element References and Constants ---
    const pointSlider = document.getElementById('point-slider');
    const sliderValueLabel = document.getElementById('slider-value-label');
    const continueButton = document.getElementById('continue-button');
    
    // Define the target URL and animation timing
    const REDIRECT_URL = 'main.html';
    const ANIMATION_DURATION_MS = 600; // Must match the CSS animation duration (0.6s)

    // Check if slider elements exist (safety check)
    if (!pointSlider || !sliderValueLabel || !continueButton) {
        console.error("Required elements for quiz.js not found in HTML.");
        return;
    }

    // --- 2. Slider UI Handling Function ---
    // This function updates the large number and the color of the slider track.
    const updateSliderUI = () => {
        const currentValue = pointSlider.value;
        sliderValueLabel.textContent = currentValue; // Update the large number label

        // Calculate percentage for visual track fill
        const min = parseInt(pointSlider.min);
        const max = parseInt(pointSlider.max);
        
        const range = max - min;
        const percentage = range > 0 ? ((currentValue - min) / range) * 100 : 0;
        
        // Use CSS linear-gradient to color the track up to the thumb's position
        // This makes the slider look filled as the user drags it.
        // Colors: #6A1B9A (Purple) and #E0E0E0 (Light Grey)
        pointSlider.style.background = `linear-gradient(to right, #6A1B9A ${percentage}%, #E0E0E0 ${percentage}%)`;
    }

    // Initialize the UI on page load
    updateSliderUI();
    continueButton.disabled = false; // Button is enabled since we start with a default prediction
    
    // Listen for slider interaction
    pointSlider.addEventListener('input', updateSliderUI);


    // --- 3. Button Click Handler with Animation and Redirect ---
    const handleSubmission = (event) => {
        event.preventDefault(); 
        
        const finalPrediction = pointSlider.value;
        console.log(`Prediction submitted: ${finalPrediction} points`);

        // 1. Disable the button to prevent double clicks
        continueButton.disabled = true;

        // 2. Trigger the success animation (defined in quiz.css)
        continueButton.classList.add('success-state');
        continueButton.textContent = 'Success!'; // Provide confirmation text

        // 3. Wait for the animation to finish, then redirect
        setTimeout(() => {
            // This is where the navigation finally happens
            window.location.href = REDIRECT_URL;

        }, ANIMATION_DURATION_MS);
    };


    // --- 4. Attach Event Listeners ---
    continueButton.addEventListener('click', handleSubmission);

    // Note: We are removing the 'Enter' key functionality on the input field
    // because the input field no longer exists (it's a slider).
});
