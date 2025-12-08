document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Element References and Constants ---
    const pointSlider = document.getElementById('point-slider');
    const sliderValueLabel = document.getElementById('slider-value-label');
    const continueButton = document.getElementById('continue-button');
    
    // YOUR DEPLOYED APPS SCRIPT URL:
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzW5jAWKQGVXflSJv3T1B_ie16Rn2rGjN4rsNKm3BdOnPFBicySDv_vfp4E5JWU-zgK/exec'; 
    
    // The base URL for the dashboard page (used for URL parameter redirect)
    const DASHBOARD_BASE_URL = 'main.html';
    const ANIMATION_DURATION_MS = 600; 

    // Safety check for required elements
    if (!pointSlider || !sliderValueLabel || !continueButton) {
        console.error("Required elements for quiz.js not found in HTML. Check IDs.");
        return;
    }

    // --- 2. Slider UI Handling Function ---
    // This function updates the large number label and the color of the slider track.
    const updateSliderUI = () => {
        const currentValue = pointSlider.value;
        sliderValueLabel.textContent = currentValue; // Update the large number label

        // Calculate percentage for visual track fill
        const min = parseInt(pointSlider.min);
        const max = parseInt(pointSlider.max);
        
        const range = max - min;
        const percentage = range > 0 ? ((currentValue - min) / range) * 100 : 0;
        
        // Use CSS linear-gradient to color the track up to the thumb's position
        // Colors: #6A1B9A (Purple) and #E0E0E0 (Light Grey)
        pointSlider.style.background = `linear-gradient(to right, #6A1B9A ${percentage}%, #E0E0E0 ${percentage}%)`;
    }

    // Initialize the UI on page load
    updateSliderUI();
    // Button is enabled since we start with a default prediction (value="2000")
    continueButton.disabled = false; 
    
    // Listen for slider interaction
    pointSlider.addEventListener('input', updateSliderUI);


    // --- 3. Button Click Handler with Animation, API Call, and Redirect ---
    const handleSubmission = (event) => {
        event.preventDefault(); 
        
        const finalPrediction = pointSlider.value;
        console.log(`Prediction submitted: ${finalPrediction} points`);

        // 1. Disable the button and trigger the success animation
        continueButton.disabled = true;
        continueButton.classList.add('success-state');
        continueButton.textContent = 'Submitting...'; 

        // 2. Send the prediction to the Google Apps Script endpoint
        fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            // 'no-cors' is necessary for simple web apps talking to Apps Script
            mode: 'no-cors', 
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prediction: finalPrediction
            })
        })
        .then(() => {
            console.log("Request sent to Google Doc via Apps Script.");
        })
        .catch(error => {
            console.error('Error sending data to Google Doc:', error);
            // We redirect anyway to maintain a good user experience, even if the logging fails
        })
        .finally(() => {
            // 3. Wait for the animation to finish (600ms), then redirect
            setTimeout(() => {
                // Construct the URL with the prediction as a parameter
                const finalRedirectURL = `${DASHBOARD_BASE_URL}?prediction=${finalPrediction}`;
                
                // Redirect to the dashboard
                window.location.href = finalRedirectURL; 
            }, ANIMATION_DURATION_MS);
        });
    };

    // --- 4. Attach Event Listener ---
    continueButton.addEventListener('click', handleSubmission);
});
