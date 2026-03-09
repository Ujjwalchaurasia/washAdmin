document.addEventListener('DOMContentLoaded', () => {

    // --- Selectors ---
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    const pages = document.querySelectorAll('.page');
    const navItems = document.querySelectorAll('.nav-item');
    const modal = document.getElementById('bookingModal');
    const closeBtn = document.querySelector('.close-btn');
    const bookingForm = document.getElementById('bookingForm');
    const tableBody = document.getElementById('bookingsTableBody');
    const pendingBookingsCountEl = document.getElementById('pendingBookingsCount');
    const modalTitle = document.getElementById('modalTitle'); 
    const bookingIdInput = document.getElementById('bookingId'); 
    const isPaidInput = document.getElementById('isPaidInput'); 
    
    // Services Page Selectors
    const addServiceForm = document.getElementById('addServiceForm');
    const servicesTableBody = document.getElementById('servicesTableBody');
    const addServiceCard = document.getElementById('addServiceCard'); 
    const serviceActionsHeader = document.getElementById('serviceActionsHeader'); 

    // Dashboard Selectors
    const dashboardTotalRevenue = document.getElementById('dashboardTotalRevenue');
    const dashboardTotalBookings = document.getElementById('dashboardTotalBookings');

    // Reports Selectors
    const reportPeriodSelect = document.getElementById('reportPeriodSelect');

    // User Management Selectors 
    const addUserForm = document.getElementById('addUserForm'); 
    const userMessage = document.getElementById('userMessage'); 
    const adminUsersTab = document.getElementById('adminUsersTab'); 
    const usersTableBody = document.getElementById('usersTableBody'); 
    const userEditModal = document.getElementById('userEditModal'); 
    const userCloseBtn = document.querySelector('.user-close-btn'); 
    const editUserForm = document.getElementById('editUserForm'); 
    const editUserMessage = document.getElementById('editUserMessage'); 

    const logoutBtn = document.getElementById('logoutBtn');
    
    let currentUserId = null; 
    let currentUserRole = 'user'; 
    
    // --- Utility Functions ---

    function showPage(pageId) {
        pages.forEach(page => {
            page.style.display = 'none';
        });
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.style.display = 'block';
        }

        navItems.forEach(item => {
            item.classList.remove('active');
        });
        const activeNavItem = document.querySelector(`.sidebar-nav a[data-page="${pageId}"]`);
        if (activeNavItem) {
             activeNavItem.parentElement.classList.add('active');
        }
    }
    
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

    // Date Format Helper Function
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        // Returns format like "11/20/2025, 10:30:00 AM"
        return date.toLocaleString('en-IN', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    // --- Authentication and Role-Based UI Logic ---
    async function checkAuthAndRedirect() {
        try {
            const response = await fetch('/api/checkAuth');
            const authStatus = await response.json();

            if (!authStatus.isAuthenticated || authStatus.role === 'user') {
                window.location.href = '/'; 
                return;
            } 
            
            currentUserRole = authStatus.role; 
            currentUserId = authStatus.userId; 
            
            const topBarH2 = document.querySelector('.top-bar h2');
            const roleDisplay = currentUserRole === 'admin' ? 'Admin' : 'Employee';
            topBarH2.textContent = `Welcome back, ${roleDisplay}!`;
            
            if (currentUserRole !== 'admin') {
                 if (adminUsersTab) adminUsersTab.style.display = 'none'; 
                 if (addServiceCard) addServiceCard.style.display = 'none';
                 if (serviceActionsHeader) serviceActionsHeader.style.display = 'none'; 
                 
                 const usersPageSection = document.getElementById('users');
                 if (usersPageSection) usersPageSection.style.display = 'none';
            }
            
            showPage('dashboard');
            loadDashboardData(); 
            loadBookings();
        } catch (error) {
            console.error('Authentication check failed:', error);
            window.location.href = '/'; 
        }
    }

    async function handleLogout() {
        try {
            const response = await fetch('/api/logout', { method: 'POST' });
            if (response.ok) {
                window.location.href = '/'; 
            } else {
                alert('Logout failed. Please try again.');
            }
        } catch (error) {
            console.error('Logout error:', error);
            alert('Network error during logout.');
        }
    }

    async function exportBookingsToCSV() {
        if (!confirm("Confirm to export all booking data to CSV?")) return;

        try {
            const response = await fetch('/api/bookings');
            if (!response.ok) throw new Error('Failed to fetch bookings data for export.');
            
            const bookings = await response.json();
            if (bookings.length === 0) {
                 alert('No bookings data available to export.');
                 return;
            }

            // CSV Headers
            const headers = ["ID", "Customer Name", "Phone", "Vehicle Type", "Vehicle Number", "Vehicle Model", "Service", "Price", "Status", "Is Paid", "Booking Date"];
            
            let csv = headers.join(',') + '\n';
            
            bookings.forEach(booking => {
                // Format the date specifically for CSV to avoid Excel issues
                // We use a simple string format so Excel treats it as text if needed
                let dateStr = formatDate(booking.bookingDate).replace(',', ''); 

                const row = [
                    booking.id,
                    `"${booking.customerName ? booking.customerName.replace(/"/g, '""') : 'N/A'}"`, 
                    booking.customerPhone || 'N/A',
                    booking.vehicleType || 'N/A',
                    booking.vehicleNumber || 'N/A',
                    booking.vehicleModel || 'N/A',
                    `"${booking.service ? booking.service.replace(/"/g, '""') : 'N/A'}"`,
                    booking.price.toFixed(2),
                    booking.status,
                    (booking.isPaid === 1 ? 'Yes' : 'No'),
                    `"${dateStr}"` // Enclose date in quotes
                ];
                csv += row.join(',') + '\n';
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `WashAdmin_Report_${new Date().toISOString().slice(0,10)}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                alert('Export successful!');
            } else {
                alert('Your browser does not support CSV download. Please update.');
            }

        } catch (error) {
            console.error('Export Error:', error);
            alert(`Export Failed: ${error.message}`);
        }
    }
    // =========================================================================


    // --- Booking Logic ---
    async function loadServicesIntoDropdown(selectElementId, selectedService = null) {
        const selectElement = document.getElementById(selectElementId);
        const datalist = document.getElementById('serviceList'); 
        datalist.innerHTML = ''; 
        
        try {
            const response = await fetch('/api/services');
            if (!response.ok) throw new Error('Failed to fetch services');
            
            const services = await response.json();
            
            services.forEach(service => {
                const option = document.createElement('option');
                option.value = service.name;
                option.textContent = `${service.name} (₹${parseFloat(service.price || 0).toFixed(2)})`; 
                datalist.appendChild(option);
            });
            
            if (selectedService) {
                selectElement.value = selectedService;
            } else {
                 selectElement.value = '';
            }

        } catch (error) {
            console.error('Error loading services:', error);
            const option = document.createElement('option');
            option.value = 'Error loading services';
            datalist.appendChild(option);
        }
    }


    async function loadBookings() {
        try {
            const response = await fetch('/api/bookings');
            if (!response.ok) throw new Error('Failed to fetch bookings');
            
            const bookings = await response.json();
            
            tableBody.innerHTML = ''; 
            let pendingCount = 0; 

            if (bookings.length === 0) {
                 tableBody.innerHTML = `<tr><td colspan="10" class="text-center">No bookings found.</td></tr>`; 
                 pendingBookingsCountEl.textContent = '0';
                 return;
            }

            bookings.forEach(booking => {
                
                if (booking.status === 'Pending') {
                    pendingCount++;
                }

                const row = tableBody.insertRow();
                const formattedPrice = parseFloat(booking.price || 0).toFixed(2);
                const isPaid = booking.isPaid || 0; 
                
                let actionButton = '';
                
                if (booking.status !== 'Cancelled') {
                    actionButton += `<button class="btn btn-sm btn-warning edit-booking-btn" data-id="${booking.id}"><i class="fas fa-edit"></i> Edit</button>`;
                }
                    
                if ((booking.status === 'Completed' || booking.status === 'Ready for Payment') && isPaid === 0) {
                     actionButton += ` <button class="btn btn-sm btn-success mark-paid-btn" data-id="${booking.id}"><i class="fas fa-money-check-alt"></i> Mark Paid</button>`;
                }
                
                if (isPaid === 1 && booking.status === 'Completed') {
                     actionButton += ` <button class="btn btn-sm btn-primary download-invoice-btn" data-id="${booking.id}"><i class="fas fa-file-pdf"></i> Invoice</button>`;
                }
                
                if (booking.status === 'Cancelled') {
                    actionButton = `<span class="status-cancelled">Cancelled</span>`;
                }

                // ✅ UPDATED ROW HTML: Includes Date Column
                row.innerHTML = `
                    <td>${booking.id}</td>
                    <td>${booking.customerName}</td>
                    <td>${booking.customerPhone || 'N/A'}</td>
                    <td>
                        ${booking.vehicleType} (${booking.vehicleNumber})<br>
                        <small class="text-secondary">${booking.vehicleModel || 'N/A'}</small>
                    </td>
                    <td>${booking.service}</td>
                    <td><span class="status ${getStatusClass(booking.status)}">${booking.status}</span></td>
                    <td>₹${formattedPrice}</td>
                    <td>${getPaymentStatusDisplay(isPaid)}</td>
                    <td style="font-size: 0.85rem;">${formatDate(booking.bookingDate)}</td> <td>${actionButton}</td>
                `;
            });

            pendingBookingsCountEl.textContent = pendingCount; 

            document.querySelectorAll('.download-invoice-btn').forEach(button => {
                 button.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    downloadInvoice(id);
                 });
            });

        } catch (error) {
            console.error('Error loading bookings:', error);
            tableBody.innerHTML = `<tr><td colspan="10">Failed to load bookings: ${error.message}</td></tr>`;
            pendingBookingsCountEl.textContent = 'Error';
        }
    }
    
    function downloadInvoice(bookingId) {
        window.open(`/api/export/invoice/${bookingId}`, '_blank');
    }


    function openAddModal() {
        modalTitle.textContent = 'Add New Booking';
        bookingIdInput.value = '';
        isPaidInput.value = '0'; 
        bookingForm.reset();
        
        document.getElementById('status').innerHTML = `
             <option value="Pending">Pending</option>
             <option value="In Progress">In Progress</option>
             <option value="Ready for Payment">Ready for Payment</option> 
             <option value="Completed">Completed</option>
             <option value="Cancelled">Cancelled</option>
        `; 
        document.getElementById('status').value = 'Pending';
        loadServicesIntoDropdown('serviceType');
        modal.style.display = 'flex';
    }

    async function openEditModal(bookingId) {
        if (currentUserRole !== 'admin' && currentUserRole !== 'employee') {
            alert('You do not have permission to edit bookings.');
            return;
        }

        try {
            const response = await fetch(`/api/bookings/${bookingId}`);
            
            if (response.status === 401) {
                 alert('Session expired. Please log in again to view/edit details.');
                 window.location.href = '/login.html'; 
                 return;
            }

            if (!response.ok) throw new Error('Failed to fetch booking details');
            
            const booking = await response.json();

            if (booking.status === 'Cancelled') {
                 alert('This booking is Cancelled and cannot be modified.');
                 return;
            }

            modalTitle.textContent = `Edit Booking #${booking.id}`;
            bookingIdInput.value = booking.id;
            isPaidInput.value = booking.isPaid || '0'; 
            document.getElementById('customerName').value = booking.customerName;
            document.getElementById('customerPhone').value = booking.customerPhone; 
            document.getElementById('vehicleType').value = booking.vehicleType;
            document.getElementById('vehicleNumber').value = booking.vehicleNumber;
            document.getElementById('vehicleModel').value = booking.vehicleModel;
            
            let statusOptions = '';
            
            if (booking.isPaid == 1) {
                 statusOptions = `
                    <option value="Completed">Completed</option>
                 `;
            } else {
                 statusOptions = `
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Ready for Payment">Ready for Payment</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                 `;
            }

            document.getElementById('status').innerHTML = statusOptions;
            document.getElementById('status').value = booking.status;
            
            await loadServicesIntoDropdown('serviceType', booking.service); 

            modal.style.display = 'flex';
        } catch (error) {
            console.error('Error loading booking for edit:', error);
            alert(`Could not load booking details: ${error.message}`);
        }
    }

    async function handleBookingSubmit(e) {
        e.preventDefault();

        const bookingData = {
            customerName: document.getElementById('customerName').value,
            customerPhone: document.getElementById('customerPhone').value, 
            vehicleType: document.getElementById('vehicleType').value,
            vehicleNumber: document.getElementById('vehicleNumber').value,
            vehicleModel: document.getElementById('vehicleModel').value,
            service: document.getElementById('serviceType').value,
            status: document.getElementById('status').value, 
            isPaid: document.getElementById('isPaidInput').value, 
            id: bookingIdInput.value || null 
        };

        const method = bookingData.id ? 'PUT' : 'POST'; 
        const url = bookingData.id ? '/api/bookings' : '/api/public-bookings'; 
        
        if (!bookingData.id) delete bookingData.id; 

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });

            if (response.status === 401) {
                 alert('Session expired. Please log in again to save changes.');
                 window.location.href = '/login.html'; 
                 return;
            }

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Booking save failed.');
            }

            modal.style.display = 'none';
            
            let alertMessage = result.message;
            if (result.acknowledgement) {
                alertMessage = `${result.acknowledgement}`;
            }

            alert(alertMessage);
            
            loadBookings();
            loadDashboardData(); 
        } catch (error) {
            console.error('Error saving booking:', error);
            alert(`Error: ${error.message}`);
        }
    }
    
    async function markAsPaid(bookingId) {
         if (!confirm(`Are you sure you want to mark Booking ID ${bookingId} as PAID? This will also set the service status to 'Completed'.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/bookings/mark-paid/${bookingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
            });

            const result = await response.json();

            if (!response.ok) {
                alert(`Payment update failed: ${result.error || 'Unknown error'}`);
            } else {
                alert(result.message);
                loadBookings(); 
                loadDashboardData(); 
            }
        } catch (error) {
            console.error('Error marking as paid:', error);
            alert('Network error. Could not mark payment.');
        }
    }


    // --- Services Logic ---
    async function loadServices(reloadChart = false) {
        try {
            const response = await fetch('/api/services'); 
            if (!response.ok) throw new Error('Failed to fetch services');
            
            const services = await response.json();
            
            servicesTableBody.innerHTML = ''; 
            
            const colspan = (currentUserRole === 'admin') ? 3 : 2; 

            if (services.length === 0) {
                 servicesTableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-center">No services defined.</td></tr>`;
                 return;
            }

            services.forEach(service => {
                const row = servicesTableBody.insertRow();
                const formattedPrice = parseFloat(service.price || 0).toFixed(2);
                
                let rowContent = `<td>${service.name}</td><td>₹${formattedPrice}</td>`;
                if (currentUserRole === 'admin') {
                   rowContent += `<td><button class="btn btn-sm btn-danger delete-service-btn" data-id="${service.id}"><i class="fas fa-trash"></i> Delete</button></td>`;
                }
                
                row.innerHTML = rowContent;
            });
            
            if (reloadChart) loadDashboardData(); 

        } catch (error) {
            console.error('Error loading services:', error);
            servicesTableBody.innerHTML = `<tr><td colspan="3">Failed to load services: ${error.message}</td></tr>`;
        }
    }

    async function handleServiceSubmit(e) {
        e.preventDefault();
        
        if (currentUserRole !== 'admin') {
             alert('You do not have permission to add services.');
             return;
        }

        const serviceName = document.getElementById('serviceName').value;
        const servicePrice = parseFloat(document.getElementById('servicePrice').value);
        
        if (isNaN(servicePrice) || servicePrice <= 0) {
            alert('Please enter a valid price.');
            return;
        }

        try {
            const response = await fetch('/api/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: serviceName, price: servicePrice })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(`Error adding service: ${data.error || response.statusText}`);
            } else {
                document.getElementById('addServiceForm').reset();
                loadServices(true); 
            }
        } catch (error) {
            console.error('Error adding service:', error);
            alert('Network error. Could not add service.');
        }
    }
    
    async function handleServiceDelete(e) {
        const deleteButton = e.target.closest('.delete-service-btn');
        
        if (currentUserRole !== 'admin') {
             alert('You do not have permission to delete services.');
             return;
        }

        if (deleteButton) {
            const serviceId = deleteButton.dataset.id;
            if (!confirm('Are you sure you want to delete this service?')) return;
            
            try {
                const response = await fetch(`/api/services/${serviceId}`, { method: 'DELETE' });

                const data = await response.json();

                if (!response.ok) {
                    alert(`Error deleting service: ${data.error || response.statusText}`);
                } else {
                    loadServices(true); 
                }
            } catch (error) {
                console.error('Error deleting service:', error);
                alert('Network error. Could not delete service.');
            }
        }
    }


    // --- Customers Logic ---
    async function loadCustomers() {
        try {
            const response = await fetch('/api/customers');
            if (!response.ok) throw new Error('Failed to fetch customers');
            
            const customers = await response.json();
            
            const customerTableBody = document.getElementById('customersTableBody');
            customerTableBody.innerHTML = ''; 
            
            if (customers.length === 0) {
                 customerTableBody.innerHTML = `<tr><td colspan="2" class="text-center">No customer data found.</td></tr>`;
                 return;
            }

            customers.forEach(customer => {
                const row = customerTableBody.insertRow();
                row.innerHTML = `
                    <td>${customer.customerName}</td>
                    <td>${customer.totalBookings}</td>
                `;
            });
        } catch (error) {
            console.error('Error loading customers:', error);
            document.getElementById('customersTableBody').innerHTML = `<tr><td colspan="2">Failed to load customer data: ${error.message}</td></tr>`;
        }
    }


    // --- Dashboard & Report Logic ---
    async function loadDashboardData() {
        try {
            const response = await fetch('/api/dashboard');
            if (!response.ok) throw new Error('Failed to fetch dashboard data');
            
            const data = await response.json();
            
            const formattedRevenue = parseFloat(data.totalRevenue || 0).toFixed(2);
            dashboardTotalRevenue.textContent = `₹${formattedRevenue}`;
            dashboardTotalBookings.textContent = data.totalBookings || 0;
            
            document.getElementById('reportTotalRevenue').textContent = `₹${formattedRevenue}`;
            document.getElementById('reportTotalBookings').textContent = data.totalBookings || 0;

            updateServiceChart(data.serviceStats); 
            loadRevenueReport(reportPeriodSelect ? reportPeriodSelect.value : 'daily'); 

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            dashboardTotalRevenue.textContent = 'Error';
            dashboardTotalBookings.textContent = 'Error';
            pendingBookingsCountEl.textContent = 'Error'; 
        }
    }

    let serviceChartInstance = null;
    function updateServiceChart(serviceStats) {
        const ctx = document.getElementById('servicePopularityChart');
        if (!ctx) return; 

        const chartCtx = ctx.getContext('2d');
        
        if (serviceChartInstance) {
            serviceChartInstance.destroy(); 
        }

        const labels = serviceStats.map(s => s.service);
        const data = serviceStats.map(s => s.count);
        
        const backgroundColors = [
            '#3498db', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6', '#34495e'
        ];

        serviceChartInstance = new Chart(chartCtx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors.slice(0, labels.length),
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    title: {
                        display: true,
                        text: 'Bookings by Service Type'
                    }
                }
            }
        });
    }
    
    let revenueTrendChartInstance = null;
    let bookingsTrendChartInstance = null;
    
    async function loadRevenueReport(period) {
        try {
            const response = await fetch(`/api/reports/summary?period=${period}`);
            if (!response.ok) throw new Error('Failed to fetch report data.');
            
            const data = await response.json();
            
            const labels = data.map(d => {
                const period = d.Period;
                if (period.match(/^\d{4}-\d{2}-\d{2}$/)) { 
                    return period.substring(5); 
                } else if (period.match(/^\d{4}-\d{2}$/)) { 
                    return period; 
                } else if (period.match(/^\d{4}-\d{2}$/)) { 
                    return `Week ${period.split('-')[1]} (${period.split('-')[0]})`;
                }
                return period;
            });
            
            const revenues = data.map(d => d.TotalRevenue);
            const bookings = data.map(d => d.TotalBookings);
            
            const ctxRevenue = document.getElementById('revenueTrendChart');
            if (ctxRevenue) {
                if (revenueTrendChartInstance) {
                    revenueTrendChartInstance.destroy();
                }
                revenueTrendChartInstance = new Chart(ctxRevenue.getContext('2d'), {
                    type: 'bar', 
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Total Revenue (₹)',
                            data: revenues,
                            backgroundColor: 'rgba(52, 152, 219, 0.9)', 
                            borderColor: 'var(--primary-color)',
                            borderWidth: 1,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: `Revenue Trend (${period.toUpperCase()})`
                            },
                            legend: {
                                display: false 
                            }
                        },
                        scales: {
                            x: { 
                                ticks: {
                                    autoSkip: false,
                                    maxRotation: 45,
                                    minRotation: 45
                                }
                            },
                            y: {
                                title: { display: true, text: 'Revenue (₹)' },
                                min: 0,
                                ticks: {
                                    precision: 0,
                                }
                            }
                        }
                    }
                });
            }

            const ctxBookings = document.getElementById('bookingsTrendChart');
            if (ctxBookings) {
                if (bookingsTrendChartInstance) {
                    bookingsTrendChartInstance.destroy();
                }
                bookingsTrendChartInstance = new Chart(ctxBookings.getContext('2d'), {
                    type: 'bar', 
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Total Bookings',
                            data: bookings,
                            backgroundColor: 'rgba(46, 204, 113, 0.9)', 
                            borderColor: 'rgba(46, 204, 113, 1)', 
                            borderWidth: 1,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: `Bookings Count Trend (${period.toUpperCase()})`
                            },
                            legend: {
                                display: false 
                            }
                        },
                        scales: {
                            x: { 
                                ticks: {
                                    autoSkip: false,
                                    maxRotation: 45,
                                    minRotation: 45
                                }
                            },
                            y: {
                                title: { display: true, text: 'Bookings Count' },
                                min: 0,
                                ticks: {
                                    precision: 0,
                                    stepSize: 1, 
                                    callback: function(value) {
                                         return value >= 0 ? Math.floor(value) : null;
                                    }
                                }
                            }
                        }
                    }
                });
            }

        } catch (error) {
            console.error('Error generating report:', error);
            const containerRevenue = document.getElementById('revenueTrendChartContainer');
            if (containerRevenue) {
                 containerRevenue.innerHTML = `<h4 style="color:var(--danger-color);">Error loading Revenue Report: ${error.message}</h4>`;
            }
            const containerBookings = document.getElementById('bookingsTrendChartContainer');
            if (containerBookings) {
                 containerBookings.innerHTML = `<h4 style="color:var(--danger-color);">Error loading Bookings Report: ${error.message}</h4>`;
            }
        }
    }


    // --- User Management Logic ---
    
    async function loadUsers() {
        if (currentUserRole !== 'admin') {
            usersTableBody.innerHTML = `<tr><td colspan="4" class="text-center">Access Denied.</td></tr>`;
            return;
        }
        
        try {
            const response = await fetch('/api/users');
            if (!response.ok) {
                 const errorText = await response.json().then(data => data.error || response.statusText).catch(() => response.statusText);
                 throw new Error(`Failed to fetch users: ${errorText}`);
            }
            
            const users = await response.json();
            usersTableBody.innerHTML = '';
            
            if (users.length === 0) {
                usersTableBody.innerHTML = `<tr><td colspan="4" class="text-center">No system users found.</td></tr>`;
                return;
            }

            users.forEach(user => {
                const row = usersTableBody.insertRow();
                
                const isProtected = (user.username === 'admin' && user.id === 1) || (user.id == currentUserId); 
                
                const actions = `
                    <button class="btn btn-sm btn-warning edit-user-btn" data-id="${user.id}"><i class="fas fa-user-edit"></i> Edit</button>
                    <button class="btn btn-sm btn-danger delete-user-btn" data-id="${user.id}" ${isProtected ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i> Delete
                    </button>
                `;
                
                row.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.username}</td>
                    <td>${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</td>
                    <td>${actions}</td>
                `;
            });
        } catch (error) {
            console.error('Error loading users:', error);
            usersTableBody.innerHTML = `<tr><td colspan="4">Failed to load users: ${error.message}</td></tr>`;
        }
    }
    
    async function openUserEditModal(userId) {
        if (currentUserRole !== 'admin') return;

        try {
            const response = await fetch(`/api/users/${userId}`);
            if (!response.ok) throw new Error('Failed to fetch user details');
            
            const user = await response.json();

            document.getElementById('editUserId').value = user.id;
            document.getElementById('editUsernameDisplay').textContent = user.username;
            document.getElementById('editUsername').value = user.username;
            document.getElementById('editUserRole').value = user.role;
            document.getElementById('newPass').value = ''; 
            editUserMessage.textContent = '';
            
            userEditModal.style.display = 'flex';
        } catch (error) {
            console.error('Error loading user for edit:', error);
            alert('Could not load user details.');
        }
    }

    async function handleUserEditSubmit(e) {
        e.preventDefault();
        
        if (currentUserRole !== 'admin') {
            editUserMessage.style.color = 'var(--danger-color)';
            editUserMessage.textContent = 'Forbidden: Only Admin can edit users.';
            return;
        }

        const userId = document.getElementById('editUserId').value;
        const username = document.getElementById('editUsername').value;
        const role = document.getElementById('editUserRole').value;
        const password = document.getElementById('newPass').value; 
        
        editUserMessage.style.color = 'var(--warning-color)';
        editUserMessage.textContent = 'Saving changes...';

        const updateData = {
            username: username,
            role: role,
            ...(password && { password: password }) 
        };

        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            const data = await response.json();

            if (!response.ok) {
                editUserMessage.style.color = 'var(--danger-color)';
                userMessage.textContent = data.error || 'Failed to update user.';
            } else {
                editUserMessage.style.color = 'var(--secondary-color)';
                editUserMessage.textContent = data.message || 'User updated successfully.';
                loadUsers(); 
                setTimeout(() => { userEditModal.style.display = 'none'; }, 2000);
            }
        } catch (error) {
            console.error('Error updating user:', error);
            editUserMessage.style.color = 'var(--danger-color)';
            editUserMessage.textContent = 'Network error. Could not update user.';
        }
    }

    async function handleAddUser(e) {
        e.preventDefault();
        
        if (currentUserRole !== 'admin') {
             userMessage.style.color = 'var(--danger-color)';
             userMessage.textContent = 'Forbidden: Only Admin can create users.';
             return;
        }
        
        const username = document.getElementById('newUsername').value;
        const password = document.getElementById('newPassword').value;
        const role = document.getElementById('userRole').value;
        
        userMessage.style.color = 'var(--danger-color)';
        userMessage.textContent = 'Processing...';

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role })
            });

            const data = await response.json();

            if (!response.ok) {
                userMessage.textContent = data.error || 'Failed to create user.';
            } else {
                userMessage.style.color = 'var(--secondary-color)';
                userMessage.textContent = `User ${username} created successfully with role: ${data.role}`;
                addUserForm.reset();
                loadUsers(); 
            }
        } catch (error) {
            console.error('Error creating user:', error);
            userMessage.textContent = 'Network error. Could not create user.';
        }
    }
    
    async function handleUserDelete(e) {
        const deleteButton = e.target.closest('.delete-user-btn');
        
        if (currentUserRole !== 'admin' || !deleteButton || deleteButton.disabled) {
             return; 
        }

        const userId = deleteButton.dataset.id;
        const username = deleteButton.closest('tr').querySelector('td:nth-child(2)').textContent;
        
        if (!confirm(`Are you sure you want to permanently delete user: ${username} (ID: ${userId})?`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
            const data = await response.json();

            if (!response.ok) {
                alert(`Error deleting user: ${data.error || response.statusText}`);
            } else {
                alert(`User ${username} deleted successfully.`);
                loadUsers(); 
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Network error. Could not delete user.');
        }
    }


    // --- Event Listeners ---
    document.querySelector('.top-bar-actions').addEventListener('click', (e) => {
        if (e.target.id === 'addBookingBtn' || e.target.closest('#addBookingBtn')) {
            openAddModal();
        }
    });

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const pageId = link.getAttribute('data-page');
            
            if (link.getAttribute('target') === '_blank') return; 

            e.preventDefault();
            
            if (pageId === 'logoutBtn') return; 

            showPage(pageId);
            
            // Ensure functions are called on page switch
            if (pageId === 'dashboard') {
                loadDashboardData();
            } else if (pageId === 'reports') {
                loadDashboardData(); 
                if(reportPeriodSelect) {
                    loadRevenueReport(reportPeriodSelect.value); 
                } else {
                    loadRevenueReport('daily'); 
                }
            } else if (pageId === 'bookings') {
                loadBookings(); 
            } else if (pageId === 'services') {
                loadServices();
            } else if (pageId === 'customers') {
                loadCustomers();
            } else if (pageId === 'users') { 
                loadUsers();
            }
        });
    });
    
    if(reportPeriodSelect) {
        reportPeriodSelect.addEventListener('change', (e) => {
            loadRevenueReport(e.target.value);
        });
    }
    
    document.querySelector('.page-content').addEventListener('click', (e) => {
        if (e.target && e.target.id === 'exportSummaryReportBtn' || e.target.closest('#exportSummaryReportBtn')) {
             exportBookingsToCSV(); 
        }
    });

    // Modal Events (Booking)
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // Modal Events (User Edit)
    userCloseBtn.addEventListener('click', () => userEditModal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === userEditModal) userEditModal.style.display = 'none';
    });

    // Forms
    bookingForm.addEventListener('submit', handleBookingSubmit);
    addServiceForm.addEventListener('submit', handleServiceSubmit);
    addUserForm.addEventListener('submit', handleAddUser); 
    editUserForm.addEventListener('submit', handleUserEditSubmit); 
    
    tableBody.addEventListener('click', (e) => {
        const editButton = e.target.closest('.edit-booking-btn');
        if (editButton) {
            const bookingId = editButton.dataset.id;
            openEditModal(bookingId);
            return; 
        }
        
        const markPaidButton = e.target.closest('.mark-paid-btn');
        if (markPaidButton) {
            const bookingId = markPaidButton.dataset.id;
            markAsPaid(bookingId);
        }
    });

    usersTableBody.addEventListener('click', (e) => {
        const editButton = e.target.closest('.edit-user-btn');
        if (editButton) {
            const userId = editButton.dataset.id;
            openUserEditModal(userId);
            return;
        }
        handleUserDelete(e);
    });

    servicesTableBody.addEventListener('click', handleServiceDelete);

    logoutBtn.addEventListener('click', handleLogout);

    
    // --- Initial Load ---
    function init() {
        checkAuthAndRedirect(); 
    }

    init();
});