
        // --- GLOBAL STATE VARIABLES ---
        const LOCAL_STORAGE_KEY = 'localLostFoundItems';
        const LOCAL_USER_ID_KEY = 'localUserId';
        const MAX_IMAGE_SIZE_BYTES = 500 * 1024; // 500 KB limit for local storage safety

        let userId = null;
        let reportedItems = [];
        let currentFilter = '';

        // DOM elements
        const itemsListEl = document.getElementById('items-list');
        const loadingIndicatorEl = document.getElementById('loading-indicator');
        const currentUserIdEl = document.getElementById('current-user-id');
        const searchInputEl = document.getElementById('search-input');
        const filterStatusEl = document.getElementById('filter-status');
        const reportFormEl = document.getElementById('report-form');
        const reportTypeSelectEl = document.getElementById('report-type');
        const itemPhotoInputEl = document.getElementById('item-photo'); 

        // Modal DOM elements
        const messageModalEl = document.getElementById('message-modal');
        const modalTitleEl = document.getElementById('modal-title');
        const modalBodyEl = document.getElementById('modal-body');
        const modalCloseBtnEl = document.getElementById('modal-close-btn');
        const navLinks = document.querySelectorAll('[data-view]');
        const views = document.querySelectorAll('.app-view');

        // Utility function to display custom modal message (replaces alert())
        function showMessageModal(title, message, isError = false) {
            modalTitleEl.textContent = title;
            modalBodyEl.textContent = message;
            
            if (isError) {
                modalTitleEl.classList.add('text-error');
                modalTitleEl.classList.remove('text-primary');
            } else {
                modalTitleEl.classList.add('text-primary');
                modalTitleEl.classList.remove('text-error');
            }

            messageModalEl.classList.add('show');
        }

        // --- IMAGE HANDLING FUNCTION (ASYNC) ---

        /**
         * Converts a File object to a Base64 string.
         * Enforces a size limit to protect local storage.
         * @param {File} file 
         * @returns {Promise<string|null>} Base64 string or null if no file is provided.
         */
        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                if (!file) {
                    resolve(null);
                    return;
                }

                if (file.size > MAX_IMAGE_SIZE_BYTES) { 
                    const maxSizeMB = (MAX_IMAGE_SIZE_BYTES / 1024 / 1024).toFixed(2);
                    reject(new Error(`Image is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Max size is ${maxSizeMB} MB for local storage.`));
                    return;
                }

                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        }

        // --- LOCAL STORAGE FUNCTIONS ---

        // 1. Load items from localStorage
        function loadItemsFromLocalStorage() {
            try {
                const storedItems = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (storedItems) {
                    reportedItems = JSON.parse(storedItems);
                } else {
                    reportedItems = [];
                }
                loadingIndicatorEl.style.display = 'none';
                renderItems(applyFilter(reportedItems, currentFilter));
            } catch (error) {
                console.error("Error loading items from local storage:", error);
                showMessageModal("Storage Error", "Could not load data from local storage. Starting with a blank slate.", true);
                reportedItems = [];
            }
        }

        // 2. Save items to localStorage
        function saveItemsToLocalStorage() {
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reportedItems));
            } catch (error) {
                console.error("Error saving items to local storage:", error);
                showMessageModal("Storage Error", "Could not save new item to local storage. Your browser storage might be full.", true);
            }
        }
        
        // 3. Initialize User ID (simulated persistence)
        function initializeLocalAuth() {
            let storedUserId = localStorage.getItem(LOCAL_USER_ID_KEY);
            if (!storedUserId) {
                // Generate a new unique ID if none exists
                storedUserId = crypto.randomUUID(); 
                localStorage.setItem(LOCAL_USER_ID_KEY, storedUserId);
            }
            userId = storedUserId;
            currentUserIdEl.textContent = `Your Local ID: ${userId}`;
        }


        // --- APPLICATION LOGIC ---

        // 1. Data Submission (Add Item) - Now ASYNC
        async function handleReportSubmit(e) {
            e.preventDefault();
            
            if (!userId) {
                showMessageModal("Access Denied", 'User ID is not set. Please refresh the page.', true);
                return;
            }

            const formData = new FormData(reportFormEl);
            const itemType = formData.get('item-type');
            const itemName = formData.get('item-name').trim();
            const description = formData.get('description').trim();
            const date = formData.get('date').trim();
            const location = formData.get('location').trim();
            const contact = formData.get('contact-info').trim();
            const imageFile = itemPhotoInputEl.files[0];

            if (!itemName || !description || !date || !location || !contact) {
                showMessageModal("Missing Fields", 'Please fill out all required fields before submitting the report.', true);
                return;
            }

            const submitBtn = reportFormEl.querySelector('.submit-btn');
            
            // Step 1: Handle image conversion
            submitBtn.disabled = true;
            submitBtn.textContent = imageFile ? 'Processing Image...' : 'Submitting...';

            let imageBase64 = null;
            try {
                imageBase64 = await fileToBase64(imageFile);
            } catch (error) {
                submitBtn.textContent = 'Submit Report';
                submitBtn.disabled = false;
                showMessageModal("Image Error", error.message, true);
                return;
            }

            // Step 2: Assemble data
            const itemData = {
                id: Date.now().toString(), 
                type: itemType, 
                name: itemName,
                description: description,
                date: date,
                location: location,
                contact: contact,
                reporterId: userId,
                timestamp: Date.now(),
                image: imageBase64 
            };
            
            // Set final submitting state before storage
            submitBtn.textContent = 'Saving Report...';

            // Step 3: Save to local array and storage
            reportedItems.push(itemData);
            saveItemsToLocalStorage();
            
            // Step 4: Finalize
            reportFormEl.reset();
            showMessageModal("Report Submitted!", `Your ${itemType} item, "${itemName}", has been saved locally.`, false);
            
            // Restore button state, re-render, and switch view
            setTimeout(() => {
                submitBtn.textContent = 'Submit Report';
                submitBtn.disabled = false;
                
                renderItems(applyFilter(reportedItems, currentFilter));
                document.getElementById('nav-items').click(); 
            }, 1000);
        }

        // 2. Filtering Logic
        function applyFilter(items, filterText) {
            const filtered = items.filter(item => {
                // Apply status filter first
                const status = filterStatusEl.value;
                if (status !== 'All' && item.type !== status) {
                    return false;
                }

                // Apply text filter
                if (!filterText) {
                    return true;
                }
                const lowerFilter = filterText.toLowerCase();
                return item.name.toLowerCase().includes(lowerFilter) ||
                       item.description.toLowerCase().includes(lowerFilter) ||
                       item.location.toLowerCase().includes(lowerFilter);
            });
            
            // Sort by newest first using the local timestamp (Date.now())
            return filtered.sort((a, b) => b.timestamp - a.timestamp);
        }

        // 3. Rendering Function
        function renderItems(itemsToRender) {
            itemsListEl.innerHTML = ''; // Clear previous content

            if (itemsToRender.length === 0) {
                const emptyStateEl = document.createElement('div');
                emptyStateEl.className = 'empty-state';
                emptyStateEl.innerHTML = `
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                    <p style="font-weight: 600;">No items match your criteria or have been reported locally.</p>
                    <p style="font-size: 0.875rem;">Reports are only saved on this browser using local storage.</p>
                `;
                itemsListEl.appendChild(emptyStateEl);
                return;
            }

            itemsToRender.forEach(item => {
                const isLost = item.type === 'Lost';
                const cardClass = isLost ? 'lost-item' : 'found-item';
                const tagClass = isLost ? 'lost-tag' : 'found-tag';
                
                const itemEl = document.createElement('div');
                itemEl.className = `item-card ${cardClass}`;
                
                // Add image if it exists in the item data
                const imageHTML = item.image 
                    ? `<img src="${item.image}" alt="Photo of ${item.name}" class="item-image">` 
                    : '';

                itemEl.innerHTML = `
                    <div class="item-header">
                        <h3>${item.name}</h3>
                        <span class="status-tag ${tagClass}">
                            ${item.type}
                        </span>
                    </div>
                    
                    ${imageHTML}
                    
                    <p class="item-description">${item.description}</p>
                    
                    <div class="item-details">
                        <div>
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            <span>Date: ${item.date}</span>
                        </div>
                        <div>
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            <span>Location: ${item.location}</span>
                        </div>
                    </div>

                    <div class="item-footer">
                        <p>Contact: <span>${item.contact}</span></p>
                        <p title="Unique ID generated locally">User ID: <span class="user-id">${item.reporterId}</span></p>
                    </div>
                `;
                itemsListEl.appendChild(itemEl);
            });
        }

        // 4. Navigation/View Management
        function setupNavigation() {
            
            navLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetView = link.getAttribute('data-view');
                    
                    // Update active state in navigation
                    navLinks.forEach(l => {
                        l.classList.remove('active');
                    });
                    
                    link.classList.add('active');


                    // Show/hide views
                    views.forEach(view => {
                        if (view.id === targetView) {
                            view.classList.remove('hidden');
                        } else {
                            view.classList.add('hidden');
                        }
                    });
                });
            });
            
            // Set up modal close button
            modalCloseBtnEl.addEventListener('click', () => {
                messageModalEl.classList.remove('show');
            });
            messageModalEl.addEventListener('click', (e) => {
                if(e.target === messageModalEl) {
                    messageModalEl.classList.remove('show');
                }
            });

            // Initial view: Show the Items List
            document.getElementById('nav-items').click();
        }

        // 5. Event listeners for search/filter
        function setupSearch() {
            // Re-run filter on text input
            searchInputEl.addEventListener('input', (e) => {
                currentFilter = e.target.value;
                renderItems(applyFilter(reportedItems, currentFilter));
            });

            // Re-run filter on status change
            filterStatusEl.addEventListener('change', () => {
                renderItems(applyFilter(reportedItems, currentFilter));
            });

            // Set up form submission
            reportFormEl.addEventListener('submit', handleReportSubmit);
            
            // Link the report type selection to the form hidden field
            document.querySelectorAll('.report-type-btn').forEach(button => {
                button.addEventListener('click', () => {
                    const type = button.getAttribute('data-type');
                    reportTypeSelectEl.value = type;
                    // Visually activate the button and deactivate the other
                    document.querySelectorAll('.report-type-btn').forEach(b => b.classList.remove('active-ring'));
                    button.classList.add('active-ring');
                });
            });
            // Initial selection for the Report Form
            document.getElementById('btn-lost').click();
        }

        // Main entry point
        window.onload = () => {
            initializeLocalAuth();
            loadItemsFromLocalStorage();
            setupNavigation();
            setupSearch();
        };
