// publicScript.js (UPDATED: With Date Validation & Button Loading)

document.addEventListener('DOMContentLoaded', () => {
    // --- Authentication Selectors ---
    const authContainer = document.getElementById('authContainer');
    const loginFormSection = document.getElementById('loginFormSection');
    const signupFormSection = document.getElementById('signupFormSection');
    const forgotPasswordSection = document.getElementById('forgotPasswordSection'); 
    
    const customerLoginForm = document.getElementById('customerLoginForm');
    const customerSignupForm = document.getElementById('customerSignupForm');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm'); 
    
    const loginMessageEl = document.getElementById('loginMessage');
    const signupMessageEl = document.getElementById('signupMessage');
    const forgotMessageEl = document.getElementById('forgotMessage'); 
    
    const customerDashboard = document.getElementById('customerDashboard');
    const welcomeHeader = document.getElementById('welcomeHeader');

    // --- Booking Selectors ---
    const publicBookingForm = document.getElementById('publicBookingForm');
    const bookingMessage = document.getElementById('bookingMessage');
    const serviceTypeSelect = document.getElementById('serviceType'); 
    const customerNameInput = document.getElementById('customerName');
    const customerPhoneInput = document.getElementById('customerPhone');
    // ✅ NEW: Email Selector
    const customerEmailInput = document.getElementById('customerEmail');
    
    // ✅ NEW: Date Input Selector for Validation
    const dateInput = document.getElementById('bookingDate');

    const customerBookingsTableBody = document.getElementById('customerBookingsTableBody');
    const priceDisplay = document.getElementById('priceDisplay'); 
    const estimatedPriceEl = document.getElementById('estimatedPrice'); 
    
    // --- UPI Selectors ---
    const upiQRPopup = document.getElementById('upiQRPopup');
    const upiAmountDisplay = document.getElementById('upiAmountDisplay');
    const upiQRCodeCanvas = document.getElementById('upiQRCodeCanvas');
    const confirmDummyPaymentBtn = document.getElementById('confirmDummyPaymentBtn');
    
    let availableServices = [];
    let currentCustomerDetails = {}; 
    let currentBookingIdForPayment = null; 

    // ✅ FEATURE 1: Date Validation (Disable Past Dates)
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
    }

    // --- Utility Functions ---
    function getStatusClass(status) {
        switch (status) {
            case 'Pending': return 'status-pending';
            case 'In Progress': return 'status-progress';
            case 'Ready for Payment': return 'status-ready-for-payment'; 
            case 'Completed': return 'status-completed';
            case 'Cancelled': return 'status-cancelled'; 
            default: return '';
        }
    }
    
    function getPaymentStatusDisplay(isPaid) {
        if (isPaid === 1) {
            return '<span class="status-paid"><i class="fas fa-check"></i> PAID</span>';
        } else {
            return '<span class="status-unpaid"><i class="fas fa-exclamation-triangle"></i> UNPAID</span>';
        }
    }
    
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
    
    // Global functions to toggle login/signup views
    window.showSignup = function() {
        loginFormSection.style.display = 'none';
        forgotPasswordSection.style.display = 'none'; 
        signupFormSection.style.display = 'block';
        loginMessageEl.textContent = '';
        signupMessageEl.textContent = '';
        forgotMessageEl.textContent = '';
    };

    window.showLogin = function() {
        loginFormSection.style.display = 'block';
        signupFormSection.style.display = 'none';
        forgotPasswordSection.style.display = 'none'; 
        loginMessageEl.textContent = '';
        signupMessageEl.textContent = '';
        forgotMessageEl.textContent = '';
    };
    
    window.showForgotPassword = function() {
        loginFormSection.style.display = 'none';
        signupFormSection.style.display = 'none';
        forgotPasswordSection.style.display = 'block';
        loginMessageEl.textContent = '';
        signupMessageEl.textContent = '';
        forgotMessageEl.textContent = '';
    };

    function showCustomerDashboard(name, phone) {
        authContainer.style.display = 'none';
        customerDashboard.style.display = 'block';
        currentCustomerDetails = { name: name, phone: phone }; 

        // Set welcome message and Logout button
        welcomeHeader.innerHTML = `
            Welcome, ${name}!
            <button class="btn btn-danger btn-sm" id="customerLogoutBtn"><i class="fas fa-sign-out-alt"></i> Logout</button>
        `;
        
        // Pre-fill and disable booking form fields
        customerNameInput.value = name;
        customerPhoneInput.value = phone;
        customerNameInput.disabled = true;
        customerPhoneInput.disabled = true;
        
        // Load services and bookings
        loadServicesIntoDropdown();
        loadCustomerBookings();
    }

    function showAuthForms() {
        authContainer.style.display = 'block';
        customerDashboard.style.display = 'none';
        showLogin();
    }

    // --- Authentication Handlers ---
    async function handleCustomerLogin(e) {
        e.preventDefault();
        loginMessageEl.textContent = 'Logging in...';
        loginMessageEl.style.color = 'var(--primary-color)';
        
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('/api/user-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            
            if (response.ok) {
                loginMessageEl.style.color = 'var(--secondary-color)';
                loginMessageEl.textContent = 'Login successful! Redirecting...';
                showCustomerDashboard(data.customerName, data.customerPhone);
            } else {
                loginMessageEl.style.color = 'var(--danger-color)';
                loginMessageEl.textContent = data.error || 'Login failed. Check credentials.';
            }
        } catch (error) {
            loginMessageEl.style.color = 'var(--danger-color)';
            loginMessageEl.textContent = 'Network error. Could not connect to the server.';
        }
    }
    
    async function handleCustomerSignup(e) {
        e.preventDefault();
        signupMessageEl.textContent = 'Creating account...';
        signupMessageEl.style.color = 'var(--primary-color)';
        
        const username = document.getElementById('signupUsername').value;
        const password = document.getElementById('signupPassword').value;
        const customerName = document.getElementById('signupName').value;
        const customerPhone = document.getElementById('signupPhone').value;

        try {
            const response = await fetch('/api/user-signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, customerName, customerPhone })
            });
            const data = await response.json();
            
            if (response.ok) {
                signupMessageEl.style.color = 'var(--secondary-color)';
                signupMessageEl.textContent = 'Signup successful! You are logged in.';
                showCustomerDashboard(data.customerName, data.customerPhone);
            } else {
                signupMessageEl.style.color = 'var(--danger-color)';
                signupMessageEl.textContent = data.error || 'Signup failed. Username may exist.';
            }
        } catch (error) {
            signupMessageEl.style.color = 'var(--danger-color)';
            signupMessageEl.textContent = 'Network error. Could not connect to the server.';
        }
    }
    
    async function handleForgotPasswordSubmit(e) {
        e.preventDefault();
        forgotMessageEl.textContent = 'Processing request...';
        forgotMessageEl.style.color = 'var(--primary-color)';
        
        const username = document.getElementById('forgotUsername').value;
        const customerPhone = document.getElementById('forgotPhone').value;
        const newPassword = document.getElementById('newPassword').value;

        if (newPassword.length < 6) {
             forgotMessageEl.style.color = 'var(--danger-color)';
             forgotMessageEl.textContent = 'New password must be at least 6 characters.';
             return;
        }

        try {
            const response = await fetch('/api/user-forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, customerPhone, newPassword })
            });
            const data = await response.json();
            
            if (response.ok) {
                forgotMessageEl.style.color = 'var(--secondary-color)';
                forgotMessageEl.textContent = data.message || 'Password reset successful!';
                setTimeout(() => {
                    showLogin();
                    document.getElementById('loginUsername').value = username;
                }, 2000);
            } else {
                forgotMessageEl.style.color = 'var(--danger-color)';
                forgotMessageEl.textContent = data.error || 'Password reset failed. Check your details.';
            }
        } catch (error) {
            forgotMessageEl.style.color = 'var(--danger-color)';
            forgotMessageEl.textContent = 'Network error. Could not connect to the server.';
        }
    }
    
    async function handleCustomerLogout() {
        if (!confirm('Are you sure you want to log out?')) return;
        try {
            const response = await fetch('/api/logout', { method: 'POST' });
            if (response.ok) {
                showAuthForms();
                alert('You have been logged out.');
            } else {
                alert('Logout failed.');
            }
        } catch (error) {
            alert('Network error during logout.');
        }
    }

    // --- Booking/Service Logic ---
    async function loadServicesIntoDropdown() {
        try {
            const response = await fetch('/api/services');
            if (!response.ok) throw new Error('Failed to fetch services');
            
            availableServices = await response.json();
            serviceTypeSelect.innerHTML = '<option value="" disabled selected>--- Select a Service ---</option>'; 
            
            if (availableServices.length === 0) {
                 bookingMessage.textContent = 'No services available.';
                 return;
            }
            
            availableServices.forEach(service => {
                const option = document.createElement('option');
                option.value = service.name;
                option.setAttribute('data-price', parseFloat(service.price).toFixed(2)); 
                option.textContent = `${service.name} (₹${parseFloat(service.price).toFixed(2)})`; 
                serviceTypeSelect.appendChild(option);
            });
            bookingMessage.textContent = ''; 
            
        } catch (error) {
            console.error('Error loading services:', error);
            bookingMessage.textContent = `Error loading services: ${error.message}`;
            bookingMessage.style.color = 'var(--danger-color)';
        }
    }
    
    serviceTypeSelect.addEventListener('change', () => {
        const selectedOption = serviceTypeSelect.options[serviceTypeSelect.selectedIndex];
        const price = selectedOption.getAttribute('data-price');
        
        if (price) {
            estimatedPriceEl.textContent = `₹${price}`;
            priceDisplay.style.display = 'block';
        } else {
            estimatedPriceEl.textContent = '₹0.00';
            priceDisplay.style.display = 'none';
        }
    });

    // ✅ FEATURE 2: UPDATED Booking Submit with Button Loading State
    async function handlePublicBookingSubmit(e) {
        e.preventDefault();
        
        // Button Selection and Loading State
        const submitBtn = publicBookingForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        bookingMessage.textContent = 'Processing your booking...';
        bookingMessage.style.color = 'var(--primary-color)';

        const serviceName = serviceTypeSelect.value; 
        const email = customerEmailInput.value; // Get Email

        // Basic Validations
        if (!serviceName) { 
            bookingMessage.textContent = 'Please select a service.';
            bookingMessage.style.color = 'var(--danger-color)';
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
            return;
        }
        if (!email) {
            bookingMessage.textContent = 'Please enter your email address.';
            bookingMessage.style.color = 'var(--danger-color)';
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
            return;
        }
        
        const bookingData = {
            customerName: customerNameInput.value,
            customerPhone: customerPhoneInput.value,
            customerEmail: email, 
            vehicleType: document.getElementById('vehicleType').value,
            vehicleNumber: document.getElementById('vehicleNumber').value,
            vehicleModel: document.getElementById('vehicleModel').value,
            service: serviceName,
            // Date value is also sent automatically if form fields match
            bookingDate: dateInput ? dateInput.value : '',
            timeSlot: document.getElementById('timeSlot') ? document.getElementById('timeSlot').value : ''
        };

        try {
            const response = await fetch('/api/public-bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });

            const result = await response.json();
            
            if (!response.ok) {
                bookingMessage.style.color = 'var(--danger-color)';
                bookingMessage.textContent = result.error || 'Booking failed.';
            } else {
                // Success
                document.getElementById('vehicleType').value = '';
                document.getElementById('vehicleNumber').value = '';
                document.getElementById('vehicleModel').value = '';
                customerEmailInput.value = ''; 
                serviceTypeSelect.value = '';
                priceDisplay.style.display = 'none';

                bookingMessage.style.color = 'var(--secondary-color)';
                bookingMessage.textContent = `✅ Success! Booking ID: ${result.id} confirmed. Invoice will be sent to your email after payment.`;
                
                loadCustomerBookings(); 
            }
        } catch (error) {
            console.error('Error saving public booking:', error);
            bookingMessage.style.color = 'var(--danger-color)';
            bookingMessage.textContent = `Network error: Could not complete booking.`;
        } finally {
            // Restore Button State
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
        }
    }
    
    // =================================================================================
    // UPI QR PAYMENT LOGIC
    // =================================================================================
    const MERCHANT_VPA = 'washadmin@upi'; 
    const MERCHANT_NAME = 'WashAdmin Car Spa';
    
    function generateUpiLink(bookingId, price) {
        const amount = parseFloat(price).toFixed(2);
        const refId = String(bookingId).padStart(12, '0'); 
        const upiLink = `upi://pay?pa=${MERCHANT_VPA}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${amount}&cu=INR&tid=${refId}&tr=${refId}&mc=5541&tn=${encodeURIComponent('Car Wash Booking ID ' + bookingId)}`;
        return upiLink;
    }

    function initiateDummyPayment(bookingId, price) {
        currentBookingIdForPayment = bookingId;
        const upiLink = generateUpiLink(bookingId, price);
        upiAmountDisplay.textContent = `₹${parseFloat(price).toFixed(2)}`;
        
        if (typeof QRious === 'undefined') {
             return alert('QR Code generator not loaded. Cannot proceed with payment.');
        }

        upiQRCodeCanvas.getContext('2d').clearRect(0, 0, upiQRCodeCanvas.width, upiQRCodeCanvas.height);
        new QRious({ element: upiQRCodeCanvas, value: upiLink, size: 250, level: 'H' });

        upiQRPopup.style.display = 'flex';
    }
    
    confirmDummyPaymentBtn.addEventListener('click', async () => {
        if (!currentBookingIdForPayment) {
             alert('Error: No active booking for confirmation.');
             return;
        }
        if (!confirm(`Did the customer successfully make the UPI payment for Booking ID ${currentBookingIdForPayment}?`)) return;
        
        upiQRPopup.style.display = 'none';
        
        try {
            const response = await fetch(`/api/bookings/mark-paid/${currentBookingIdForPayment}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
            });
            const result = await response.json();
            if (response.ok) {
                alert(`✅ Payment Success! ${result.message}`);
                currentBookingIdForPayment = null; 
                loadCustomerBookings(); 
            } else {
                alert(`❌ Payment failed or already processed: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            alert("Network error during payment confirmation.");
        }
    });

    // =================================================================================
    
    // Cancel Booking Handler
    async function handleCancelBooking(bookingId) {
        if (!confirm(`Are you sure you want to CANCEL Booking ID ${bookingId}? This action cannot be undone.`)) return;

        try {
            const response = await fetch(`/api/customer-bookings/cancel/${bookingId}`, { method: 'DELETE' });
            const result = await response.json();

            if (!response.ok) {
                alert(`Cancellation failed: ${result.error || 'Unknown error'}.`);
            } else {
                alert(`✅ ${result.message}`);
                loadCustomerBookings(); 
            }
        } catch (error) {
            alert('Network error. Could not connect to the server for cancellation.');
        }
    }

    async function loadCustomerBookings() {
        customerBookingsTableBody.innerHTML = '<tr><td colspan="8">Loading your bookings...</td></tr>';

        try {
            const response = await fetch('/api/customer-bookings');
            if (response.status === 401) {
                showAuthForms();
                return;
            }
            if (!response.ok) throw new Error('Failed to fetch bookings');
            
            const bookings = await response.json();
            customerBookingsTableBody.innerHTML = '';
            
            if (bookings.length === 0) {
                 customerBookingsTableBody.innerHTML = '<tr><td colspan="8" class="text-center">You have no active or past bookings.</td></tr>';
                 return;
            }

            bookings.forEach(booking => {
                const row = customerBookingsTableBody.insertRow();
                const formattedPrice = parseFloat(booking.price || 0).toFixed(2);
                let actionCell = '<td>N/A</td>';
                
                if (booking.status === 'Ready for Payment' && booking.isPaid === 0) {
                    actionCell = `
                        <td>
                            <button class="btn btn-success btn-sm pay-online-btn" 
                                data-id="${booking.id}" data-price="${formattedPrice}">
                                <i class="fas fa-qrcode"></i> Pay by UPI
                            </button>
                        </td>`;
                } else if (booking.status === 'Pending') {
                     actionCell = `
                        <td>
                            <button class="btn btn-danger btn-sm cancel-booking-btn" 
                                data-id="${booking.id}">
                                <i class="fas fa-times-circle"></i> Cancel
                            </button>
                        </td>`;
                } else if (booking.status === 'Completed' && booking.isPaid === 0) {
                    actionCell = `<td><span class="status-unpaid">Payment Due (Cash)</span></td>`;
                }

                row.innerHTML = `
                    <td>${booking.id}</td>
                    <td>${booking.vehicleType} (${booking.vehicleNumber})</td>
                    <td>${booking.service}</td>
                    <td>₹${formattedPrice}</td>
                    <td><span class="${getStatusClass(booking.status)}">${booking.status}</span></td>
                    <td>${getPaymentStatusDisplay(booking.isPaid)}</td> 
                    <td>${formatDate(booking.bookingDate)}</td>
                    ${actionCell}
                `;
            });
            
            document.querySelectorAll('.pay-online-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    const price = e.currentTarget.dataset.price;
                    initiateDummyPayment(id, price);
                });
            });
            
            document.querySelectorAll('.cancel-booking-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    handleCancelBooking(id);
                });
            });

        } catch (error) {
            customerBookingsTableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="color:var(--danger-color);">Error loading bookings.</td></tr>`;
        }
    }
    
    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/checkAuth');
            const authStatus = await response.json();
            if (authStatus.isAuthenticated && authStatus.role === 'user') {
                showCustomerDashboard(authStatus.customerName, authStatus.customerPhone);
            } else {
                showAuthForms();
            }
        } catch (error) {
            showAuthForms();
        }
    }

    // --- Event Listeners ---
    customerLoginForm.addEventListener('submit', handleCustomerLogin);
    customerSignupForm.addEventListener('submit', handleCustomerSignup);
    forgotPasswordForm.addEventListener('submit', handleForgotPasswordSubmit); 
    publicBookingForm.addEventListener('submit', handlePublicBookingSubmit);
    
    customerDashboard.addEventListener('click', (e) => {
        if (e.target && (e.target.id === 'customerLogoutBtn' || e.target.closest('#customerLogoutBtn'))) {
            handleCustomerLogout();
        }
    });
    
    upiQRPopup.addEventListener('click', (e) => {
        if (e.target === upiQRPopup) upiQRPopup.style.display = 'none';
    });

    checkAuthStatus();
});