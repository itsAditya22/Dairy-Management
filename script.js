 // --- Data Models & Storage ---
        const DB = {
            get(key) {
                return JSON.parse(localStorage.getItem('dms_' + key)) || [];
            },
            set(key, data) {
                localStorage.setItem('dms_' + key, JSON.stringify(data));
            },
            // Generate simple unique char ID
            uid() {
                return Date.now().toString(36) + Math.random().toString(36).substr(2);
            }
        };

        // --- Core Application Logic ---
        const app = {
            currentView: 'dashboard',
            
            init() {
                this.updateDate();
                this.navigate('dashboard');
                
                // Initialize default data if empty
                if(DB.get('animals').length === 0) {
                   // Seed some data for demo if totally empty
                }
            },

            updateDate() {
                const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', options);
            },

            toggleSidebar() {
                document.getElementById('sidebar').classList.toggle('open');
            },

            navigate(view) {
                this.currentView = view;
                document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
                document.querySelector(`.nav-item[onclick="app.navigate('${view}')"]`).classList.add('active');
                
                const titleMap = {
                    'dashboard': 'Dashboard',
                    'animals': 'Animal Management',
                    'milk': 'Milk Collection',
                    'customers': 'Customer Management',
                    'expenses': 'Expense Tracking',
                    'reports': 'Reports & Analytics'
                };
                document.getElementById('page-title').innerText = titleMap[view];

                const content = document.getElementById('content');
                content.innerHTML = ''; // Clear content
                
                // Route to render function
                if (this[view + 'View']) {
                    content.innerHTML = this[view + 'View']();
                    if(this[view + 'AfterRender']) this[view + 'AfterRender']();
                }
                
                // Close mobile sidebar on navigate
                if(window.innerWidth <= 768) {
                    document.getElementById('sidebar').classList.remove('open');
                }
            },

            // --- Views ---

            dashboardView() {
                const animals = DB.get('animals');
                const milk = DB.get('milk');
                const customers = DB.get('customers');
                const expenses = DB.get('expenses');

                const todayStr = new Date().toISOString().split('T')[0];
                const todayMilk = milk
                    .filter(m => m.date === todayStr)
                    .reduce((sum, m) => sum + parseFloat(m.qty), 0);
                
                // Calculate monthly earnings (approximate for dashboard)
                const currentMonth = new Date().toISOString().slice(0, 7);
                // In a real app, earnings depend on who bought what, 
                // but for dashboard summary lets assume all milk is sold at average rate or logged sales.
                // Simplified: Total Income = (Total Milk * Avg Rate) - usually it's per customer.
                // Better metric for dashboard here: Total Collections this month.
                const monthMilk = milk.filter(m => m.date.startsWith(currentMonth)).reduce((s, m) => s + parseFloat(m.qty), 0);
                
                // Calculate Expense this month
                const monthExp = expenses.filter(e => e.date.startsWith(currentMonth)).reduce((s, e) => s + parseFloat(e.amount), 0);

                return `
                    <div class="stats-grid">
                        <div class="card">
                            <h3>Total Animals</h3>
                            <div class="value text-success">${animals.length}</div>
                        </div>
                        <div class="card">
                            <h3>Today's Milk (L)</h3>
                            <div class="value text-primary">${todayMilk.toFixed(1)}</div>
                        </div>
                        <div class="card">
                            <h3>Active Customers</h3>
                            <div class="value text-secondary">${customers.length}</div>
                        </div>
                        <div class="card">
                            <h3>Month Expenses</h3>
                            <div class="value text-danger">₹${monthExp.toLocaleString()}</div>
                        </div>
                    </div>

                    <div class="chart-container">
                        <canvas id="milkChart"></canvas>
                    </div>

                    <div class="card">
                        <h3>Recent Activity</h3>
                        <table style="margin-top:10px;">
                            <thead><tr><th>Date</th><th>Type</th><th>Detail</th></tr></thead>
                            <tbody>
                                ${milk.slice(-5).reverse().map(m => `
                                    <tr>
                                        <td>${m.date}</td>
                                        <td>Milk Entry</td>
                                        <td>${m.qty}L from ${this.getAnimalName(m.animalId)} (${m.shift})</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            },

            dashboardAfterRender() {
                this.renderChart();
            },

            renderChart() {
                const ctx = document.getElementById('milkChart');
                if(!ctx) return;
                
                const canvas = ctx;
                const c = canvas.getContext('2d');
                
                // Make high res
                const dpr = window.devicePixelRatio || 1;
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                c.scale(dpr, dpr);

                const W = rect.width;
                const H = rect.height;
                const padding = 40;

                // Get last 7 days data
                const labels = [];
                const data = [];
                for(let i=6; i>=0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const ds = d.toISOString().split('T')[0];
                    labels.push(ds.slice(5)); // MM-DD
                    
                    const dayTotal = DB.get('milk')
                        .filter(m => m.date === ds)
                        .reduce((sum, m) => sum + parseFloat(m.qty), 0);
                    data.push(dayTotal);
                }

                // Draw Chart
                c.clearRect(0,0,W,H);
                
                // Title
                c.font = "bold 14px Segoe UI";
                c.fillStyle = "#374151";
                c.fillText("Last 7 Days Milk Production (Liters)", 10, 20);

                const maxVal = Math.max(...data, 10); // min 10
                const graphH = H - padding * 2;
                const graphW = W - padding * 2;
                
                // Axis
                c.beginPath();
                c.moveTo(padding, padding);
                c.lineTo(padding, H - padding);
                c.lineTo(W - padding, H - padding);
                c.strokeStyle = "#e5e7eb";
                c.stroke();

                // Bars
                const barWidth = (graphW / data.length) * 0.6;
                const step = graphW / data.length;
                
                data.forEach((val, i) => {
                    const h = (val / maxVal) * graphH;
                    const x = padding + (step * i) + (step - barWidth)/2;
                    const y = H - padding - h;
                    
                    c.fillStyle = "#10b981";
                    c.fillRect(x, y, barWidth, h);
                    
                    // Labels
                    c.fillStyle = "#6b7280";
                    c.font = "10px Segoe UI";
                    c.textAlign = "center";
                    c.fillText(labels[i], x + barWidth/2, H - padding + 15);
                    
                    // Value
                    c.fillStyle = "#374151";
                    c.fillText(val, x + barWidth/2, y - 5);
                });
            },

            animalsView() {
                const animals = DB.get('animals');
                return `
                    <div class="table-container">
                        <div class="table-header">
                            <h3>Animal Records</h3>
                            <button class="btn btn-primary" onclick="app.openAnimalModal()">+ Add Animal</button>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Tag ID</th>
                                    <th>Type</th>
                                    <th>Breed</th>
                                    <th>Age (Y)</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${animals.length ? animals.map(a => `
                                    <tr>
                                        <td>${a.tagId}</td>
                                        <td>${a.type}</td>
                                        <td>${a.breed}</td>
                                        <td>${a.age}</td>
                                        <td><span class="badge ${a.status === 'Milking' ? 'badge-green' : 'badge-red'}">${a.status}</span></td>
                                        <td>
                                            <button class="btn-sm btn-secondary" onclick="app.editAnimal('${a.id}')">Edit</button>
                                            <button class="btn-sm btn-danger" onclick="app.deleteAnimal('${a.id}')">Del</button>
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="6" style="text-align:center">No animals found.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                `;
            },

            // --- Milk Collection Views ---
            milkView() {
                const milk = DB.get('milk');
                const animals = DB.get('animals');
                return `
                     <div class="table-container">
                        <div class="table-header">
                            <h3>Milk Collection Log</h3>
                            <div style="display:flex; gap:10px;">
                                <input type="date" id="milkFilterDate" onchange="app.renderMilkTable(this.value)" class="form-control" style="width: auto; padding: 0.4rem;">
                                <button class="btn btn-primary" onclick="app.openMilkModal()">+ Add Entry</button>
                            </div>
                        </div>
                        <div id="milkTableWrapper">
                            ${this.getMilkTableHTML(milk)}
                        </div>
                    </div>
                `;
            },

            renderMilkTable(dateFilter) {
                let milk = DB.get('milk');
                if (dateFilter) {
                    milk = milk.filter(m => m.date === dateFilter);
                }
                document.getElementById('milkTableWrapper').innerHTML = this.getMilkTableHTML(milk);
            },

            getMilkTableHTML(milkData) {
                 // Sort by date desc
                const sorted = [...milkData].sort((a,b) => new Date(b.date + ' ' + (b.shift==='Evening'? '20:00':'08:00')) - new Date(a.date + ' ' + (a.shift==='Evening'? '20:00':'08:00')));
                
                return `
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Shift</th>
                                <th>Animal Tag</th>
                                <th>Qty (L)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                         <tbody>
                            ${sorted.length ? sorted.map(m => `
                                <tr>
                                    <td>${m.date}</td>
                                    <td><span class="badge ${m.shift === 'Morning' ? 'badge-blue' : 'badge-green'}">${m.shift}</span></td>
                                    <td>${this.getAnimalName(m.animalId)}</td>
                                    <td>${m.qty}</td>
                                    <td>
                                        <button class="btn-sm btn-danger" onclick="app.deleteMilk('${m.id}')">Del</button>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="5" style="text-align:center">No entries found.</td></tr>'}
                        </tbody>
                    </table>
                `;
            },

            // --- Customers Views ---
            customersView() {
                const customers = DB.get('customers');
                return `
                    <div class="table-container">
                        <div class="table-header">
                            <h3>Customer Directory</h3>
                            <button class="btn btn-primary" onclick="app.openCustomerModal()">+ Add Customer</button>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Phone</th>
                                    <th>Rate/L (₹)</th>
                                    <th>Monthly Est.</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${customers.length ? customers.map(c => `
                                    <tr>
                                        <td>${c.name}</td>
                                        <td>${c.phone}</td>
                                        <td>${c.rate}</td>
                                        <td>₹${(c.rate * 30 * (c.dailyQty || 1)).toLocaleString()}</td>
                                        <td>
                                            <button class="btn-sm btn-secondary" onclick="app.editCustomer('${c.id}')">Edit</button>
                                            <button class="btn-sm btn-danger" onclick="app.deleteCustomer('${c.id}')">Del</button>
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="5" style="text-align:center">No customers found.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                `;
            },

            // --- Expenses Views ---
            expensesView() {
                const expenses = DB.get('expenses');
                return `
                     <div class="table-container">
                        <div class="table-header">
                            <h3>Expense Tracker</h3>
                            <button class="btn btn-primary" onclick="app.openExpenseModal()">+ Add Expense</button>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Category</th>
                                    <th>Description</th>
                                    <th>Amount (₹)</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${expenses.length ? expenses.sort((a,b)=> new Date(b.date)-new Date(a.date)).map(e => `
                                    <tr>
                                        <td>${e.date}</td>
                                        <td>${e.category}</td>
                                        <td>${e.details}</td>
                                        <td class="text-danger font-bold">₹${parseFloat(e.amount).toLocaleString()}</td>
                                        <td><button class="btn-sm btn-danger" onclick="app.deleteExpense('${e.id}')">Del</button></td>
                                    </tr>
                                `).join('') : '<tr><td colspan="5" style="text-align:center">No expenses found.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                `;
            },

            // --- Reports Views ---
            reportsView() {
                const today = new Date().toISOString().split('T')[0];
                return `
                    <div class="card no-print">
                        <h3>Generate Report</h3>
                        <div style="display: flex; gap: 15px; align-items: flex-end; margin-top: 10px;">
                            <div class="form-group" style="margin:0; flex:1;">
                                <label>Month</label>
                                <input type="month" id="reportMonth" value="${today.slice(0,7)}" max="${today.slice(0,7)}">
                            </div>
                            <button class="btn btn-primary" onclick="app.generateReport()">View Report</button>
                            <button class="btn btn-secondary" onclick="window.print()">🖨 Print</button>
                        </div>
                    </div>
                    <div id="reportResult" style="margin-top:20px;"></div>
                `;
            },

            generateReport() {
                const month = document.getElementById('reportMonth').value;
                if(!month) return;

                const milk = DB.get('milk').filter(m => m.date.startsWith(month));
                const expenses = DB.get('expenses').filter(e => e.date.startsWith(month));
                
                const totalMilk = milk.reduce((sum,m) => sum + parseFloat(m.qty), 0);
                const totalExp = expenses.reduce((sum,e) => sum + parseFloat(e.amount), 0);
                
                // Income Calculation assumption: 
                // In a real system, you'd link milk entries to sales or have a separate sales log.
                // Here we will approximate income based on an average rate from customers or a fixed rate.
                // Let's use an average rate of sales for simplicity or just report Milk production.
                // To show "Profit", we need concrete income. Let's assume all milk is sold at ₹50/L for report simplicity 
                // OR calculate derived from Customer daily quotas.
                // Let's go with a configurable stats or just a default rate for the report.
                const AVG_RATE = 50; 
                const estIncome = totalMilk * AVG_RATE;
                const netProfit = estIncome - totalExp;

                const html = `
                    <div class="card">
                        <div style="text-align:center; padding-bottom: 20px; border-bottom: 1px dashed #ccc; margin-bottom: 20px;">
                            <h2>Monthly Report: ${month}</h2>
                            <p>Generated on ${new Date().toLocaleString()}</p>
                        </div>

                        <div class="stats-grid">
                            <div style="text-align:center">
                                <h3 style="font-size: 1rem;">Total Milk Produced</h3>
                                <div class="value text-primary">${totalMilk.toFixed(1)} L</div>
                            </div>
                            <div style="text-align:center">
                                <h3 style="font-size: 1rem;">Total Expenses</h3>
                                <div class="value text-danger">₹${totalExp.toLocaleString()}</div>
                            </div>
                             <div style="text-align:center">
                                <h3 style="font-size: 1rem;">Est. Gross Income (@ ₹${AVG_RATE}/L)</h3>
                                <div class="value text-success">₹${estIncome.toLocaleString()}</div>
                            </div>
                            <div style="text-align:center">
                                <h3 style="font-size: 1rem;">Net Profit</h3>
                                <div class="value ${netProfit >=0 ? 'text-success':'text-danger'}">₹${netProfit.toLocaleString()}</div>
                            </div>
                        </div>

                        <h3 style="margin-top:30px; margin-bottom:10px;">Expense Breakdown</h3>
                        <table>
                             <thead><tr><th>Date</th><th>Category</th><th>Amount</th></tr></thead>
                             <tbody>
                                ${expenses.map(e => `<tr><td>${e.date}</td><td>${e.category}</td><td>₹${e.amount}</td></tr>`).join('')}
                             </tbody>
                        </table>
                    </div>
                `;
                document.getElementById('reportResult').innerHTML = html;
            },

            // --- Modals & Actions ---
            getAnimalName(id) {
                const a = DB.get('animals').find(x => x.id === id);
                return a ? `${a.tagId} (${a.breed})` : 'Unknown';
            },

            closeModal() {
                document.getElementById('modal').classList.remove('active');
            },

            // Animal Actions
            openAnimalModal(editId = null) {
                let animal = { id: '', tagId: '', type: 'Cow', breed: '', age: '', status: 'Milking' };
                let title = 'Add New Animal';
                
                if(editId) {
                    animal = DB.get('animals').find(a => a.id === editId);
                    title = 'Edit Animal';
                }

                document.getElementById('modal-title').innerText = title;
                document.getElementById('modal-body').innerHTML = `
                    <input type="hidden" id="a_id" value="${animal.id || ''}">
                    <div class="form-group">
                        <label>Tag ID / Name</label>
                        <input type="text" id="a_tag" value="${animal.tagId}">
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select id="a_type">
                            <option value="Cow" ${animal.type==='Cow'?'selected':''}>Cow</option>
                            <option value="Buffalo" ${animal.type==='Buffalo'?'selected':''}>Buffalo</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Breed</label>
                        <input type="text" id="a_breed" value="${animal.breed}">
                    </div>
                     <div class="form-group">
                        <label>Age (Years)</label>
                        <input type="number" id="a_age" value="${animal.age}">
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select id="a_status">
                            <option value="Milking" ${animal.status==='Milking'?'selected':''}>Milking</option>
                            <option value="Dry" ${animal.status==='Dry'?'selected':''}>Dry</option>
                            <option value="Sick" ${animal.status==='Sick'?'selected':''}>Sick</option>
                        </select>
                    </div>
                `;
                document.getElementById('modal-footer').innerHTML = `
                    <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="app.saveAnimal()">Save</button>
                `;
                document.getElementById('modal').classList.add('active');
            },

            saveAnimal() {
                const id = document.getElementById('a_id').value;
                const tag = document.getElementById('a_tag').value;
                const type = document.getElementById('a_type').value;
                const breed = document.getElementById('a_breed').value;
                const age = document.getElementById('a_age').value;
                const status = document.getElementById('a_status').value;

                if(!tag) return alert('Tag ID is required');

                let list = DB.get('animals');
                if(id) {
                    const idx = list.findIndex(a => a.id === id);
                    if(idx !== -1) list[idx] = { id, tagId: tag, type, breed, age, status };
                } else {
                    list.push({ id: DB.uid(), tagId: tag, type, breed, age, status });
                }
                
                DB.set('animals', list);
                this.closeModal();
                this.navigate('animals');
            },

            deleteAnimal(id) {
                if(confirm('Delete this animal?')) {
                    const list = DB.get('animals').filter(a => a.id !== id);
                    DB.set('animals', list);
                    this.navigate('animals');
                }
            },
            
            editAnimal(id) {
                this.openAnimalModal(id);
            },

            // Milk Actions
            openMilkModal() {
                 const animals = DB.get('animals').filter(a => a.status === 'Milking');
                 if(animals.length === 0) return alert('No milking animals found. Add an animal with "Milking" status first.');

                 document.getElementById('modal-title').innerText = 'Add Milk Entry';
                 const today = new Date().toISOString().split('T')[0];
                 
                 document.getElementById('modal-body').innerHTML = `
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="m_date" value="${today}">
                    </div>
                    <div class="form-group">
                        <label>Shift</label>
                        <select id="m_shift">
                            <option value="Morning">Morning</option>
                            <option value="Evening">Evening</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Animal</label>
                        <select id="m_animal">
                            ${animals.map(a => `<option value="${a.id}">${a.tagId} - ${a.breed}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Quantity (Liters)</label>
                        <input type="number" step="0.1" id="m_qty" placeholder="e.g. 5.5">
                    </div>
                 `;
                 document.getElementById('modal-footer').innerHTML = `
                    <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="app.saveMilk()">Save</button>
                `;
                document.getElementById('modal').classList.add('active');
            },

            saveMilk() {
                const date = document.getElementById('m_date').value;
                const shift = document.getElementById('m_shift').value;
                const animalId = document.getElementById('m_animal').value;
                const qty = document.getElementById('m_qty').value;

                if(!qty || qty <= 0) return alert('Valid Quantity is required');

                let list = DB.get('milk');
                list.push({ id: DB.uid(), date, shift, animalId, qty });
                DB.set('milk', list);
                
                this.closeModal();
                this.navigate('milk'); // refresh
            },

            deleteMilk(id) {
                 if(confirm('Delete this entry?')) {
                    const list = DB.get('milk').filter(a => a.id !== id);
                    DB.set('milk', list);
                    this.navigate('milk');
                }
            },

            // Customer Actions
            openCustomerModal(editId = null) {
                let cust = { id: '', name: '', phone: '', dailyQty: '', rate: '' };
                let title = "Add Customer";
                if(editId) {
                    cust = DB.get('customers').find(c => c.id === editId);
                    title = "Edit Customer";
                }

                document.getElementById('modal-title').innerText = title;
                document.getElementById('modal-body').innerHTML = `
                    <input type="hidden" id="c_id" value="${cust.id}">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" id="c_name" value="${cust.name}">
                    </div>
                     <div class="form-group">
                        <label>Phone</label>
                        <input type="text" id="c_phone" value="${cust.phone}">
                    </div>
                     <div class="form-group">
                        <label>Daily Qty Quota (L)</label>
                        <input type="number" step="0.5" id="c_qty" value="${cust.dailyQty}">
                    </div>
                     <div class="form-group">
                        <label>Rate per Liter (₹)</label>
                        <input type="number" id="c_rate" value="${cust.rate}">
                    </div>
                `;
                document.getElementById('modal-footer').innerHTML = `
                    <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="app.saveCustomer()">Save</button>
                `;
                document.getElementById('modal').classList.add('active');
            },

            saveCustomer() {
                const id = document.getElementById('c_id').value;
                const name = document.getElementById('c_name').value;
                const phone = document.getElementById('c_phone').value;
                const rate = document.getElementById('c_rate').value;
                const dailyQty = document.getElementById('c_qty').value || 1;

                if(!name || !rate) return alert('Name and Rate are required');

                let list = DB.get('customers');
                if(id) {
                    const idx = list.findIndex(c => c.id === id);
                    if(idx!=-1) list[idx] = { id, name, phone, dailyQty, rate };
                } else {
                    list.push({ id: DB.uid(), name, phone, dailyQty, rate});
                }
                DB.set('customers', list);
                this.closeModal();
                this.navigate('customers');
            },

            deleteCustomer(id) {
                if(confirm('Delete Customer?')) {
                    const list = DB.get('customers').filter(a => a.id !== id);
                    DB.set('customers', list);
                    this.navigate('customers');
                }
            },
            editCustomer(id) { this.openCustomerModal(id); },

            // Expense Actions
            openExpenseModal() {
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('modal-title').innerText = "Add Expense";
                document.getElementById('modal-body').innerHTML = `
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="e_date" value="${today}">
                    </div>
                    <div class="form-group">
                        <label>Category</label>
                        <select id="e_cat">
                            <option value="Feed">Feed / Fodder</option>
                            <option value="Veterinary">Veterinary / Medicine</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Salary">Staff Salary</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Details</label>
                        <input type="text" id="e_desc" placeholder="Details (e.g. 5 bags of Cattle Feed)">
                    </div>
                    <div class="form-group">
                        <label>Amount (₹)</label>
                        <input type="number" id="e_amt">
                    </div>
                `;
                document.getElementById('modal-footer').innerHTML = `
                    <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="app.saveExpense()">Save</button>
                `;
                document.getElementById('modal').classList.add('active');
            },

            saveExpense() {
                const date = document.getElementById('e_date').value;
                const category = document.getElementById('e_cat').value;
                const details = document.getElementById('e_desc').value;
                const amount = document.getElementById('e_amt').value;

                if(!amount) return alert('Amount is required');

                let list = DB.get('expenses');
                list.push({ id: DB.uid(), date, category, details, amount });
                DB.set('expenses', list);
                this.closeModal();
                this.navigate('expenses');
            },

            deleteExpense(id) {
                 if(confirm('Delete Expense?')) {
                    const list = DB.get('expenses').filter(a => a.id !== id);
                    DB.set('expenses', list);
                    this.navigate('expenses');
                }
            }
        };

        // Init App
        window.addEventListener('DOMContentLoaded', () => {
            app.init();
        });
