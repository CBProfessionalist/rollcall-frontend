// API_BASE_URL is now defined in index.html and dashboard.html
// DO NOT redeclare it here!

// Initialize on page load
$(document).ready(function() {
    console.log('✅ App loaded with API URL:', API_BASE_URL);
    
    // Load data based on current page
    if ($('#studentsTable').length) {
        loadDashboardStats();
        loadStudents();
        loadSettings();
        loadHolidays();
    }
    
    if ($('#attendanceTable').length) {
        loadStudentFilter();
        loadAttendanceRecords();
    }
    
    // Setup event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Student form submit
    $('#studentForm').on('submit', function(e) {
        e.preventDefault();
        addStudent();
    });
    
    // Filter form submit
    $('#filterForm').on('submit', function(e) {
        e.preventDefault();
        loadAttendanceRecords();
    });
    
    // Logout button
    $('#logoutBtn').on('click', function(e) {
        e.preventDefault();
        logout();
    });
}

// Logout function
function logout() {
    $.ajax({
        url: `${API_BASE_URL}/logout`,
        method: 'POST',
        xhrFields: { withCredentials: true },
        success: function() {
            window.location.href = 'login.html';
        },
        error: function() {
            window.location.href = 'login.html';
        }
    });
}

// Load dashboard statistics
function loadDashboardStats() {
    // Get total students
    $.ajax({
        url: `${API_BASE_URL}/students`,
        method: 'GET',
        xhrFields: { withCredentials: true },
        success: function(students) {
            $('#totalStudents').text(students.length);
        },
        error: function(xhr) {
            console.error('Error loading students:', xhr.responseText);
        }
    });
    
    // Get today's attendance
    const today = new Date().toISOString().split('T')[0];
    $.ajax({
        url: `${API_BASE_URL}/attendance?start_date=${today}&end_date=${today}`,
        method: 'GET',
        xhrFields: { withCredentials: true },
        success: function(attendance) {
            $('#presentToday').text(attendance.length);
            
            // Get absent count
            $.ajax({
                url: `${API_BASE_URL}/students`,
                method: 'GET',
                xhrFields: { withCredentials: true },
                success: function(students) {
                    const absentToday = students.length - attendance.length;
                    $('#absentToday').text(absentToday);
                }
            });
        },
        error: function(xhr) {
            console.error('Error loading attendance:', xhr.responseText);
        }
    });
    
    // Check for long absences (5+ days)
    checkLongAbsences();
}

// Check for long absences
function checkLongAbsences() {
    $.ajax({
        url: `${API_BASE_URL}/students`,
        method: 'GET',
        xhrFields: { withCredentials: true },
        success: function(students) {
            let longAbsenceCount = 0;
            const fiveDaysAgo = new Date();
            fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
            const fiveDaysAgoStr = fiveDaysAgo.toISOString().split('T')[0];
            const today = new Date().toISOString().split('T')[0];
            
            students.forEach(student => {
                $.ajax({
                    url: `${API_BASE_URL}/attendance?student_id=${student.student_id}&start_date=${fiveDaysAgoStr}&end_date=${today}`,
                    method: 'GET',
                    xhrFields: { withCredentials: true },
                    success: function(attendance) {
                        if (attendance.length === 0) {
                            longAbsenceCount++;
                            $('#longAbsences').text(longAbsenceCount);
                        }
                    }
                });
            });
        }
    });
}

// Load students into table
function loadStudents() {
    $.ajax({
        url: `${API_BASE_URL}/students`,
        method: 'GET',
        xhrFields: { withCredentials: true },
        success: function(students) {
            const tbody = $('#studentsTable tbody');
            tbody.empty();
            
            students.forEach(student => {
                const date = new Date(student.created_at).toLocaleDateString();
                tbody.append(`
                    <tr>
                        <td>${student.ic_number}</td>
                        <td>${student.student_id}</td>
                        <td>${student.student_name}</td>
                        <td>${date}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-danger delete-student" data-id="${student.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `);
            });
            
            // Add delete handlers
            $('.delete-student').click(function() {
                const studentId = $(this).data('id');
                deleteStudent(studentId);
            });
            
            // Update student filter if it exists
            updateStudentFilter(students);
        },
        error: function(xhr) {
            console.error('Error loading students:', xhr.responseText);
        }
    });
}

// Update student filter dropdown
function updateStudentFilter(students) {
    const filterSelect = $('#student_filter');
    if (!filterSelect.length) return;
    
    filterSelect.empty();
    filterSelect.append('<option value="">All Students</option>');
    
    students.forEach(student => {
        filterSelect.append(`<option value="${student.student_id}">${student.student_name}</option>`);
    });
}

// Load student filter for attendance page
function loadStudentFilter() {
    $.ajax({
        url: `${API_BASE_URL}/students`,
        method: 'GET',
        xhrFields: { withCredentials: true },
        success: function(students) {
            updateStudentFilter(students);
        }
    });
}

// Add new student
function addStudent() {
    const student = {
        ic_number: $('#ic_number').val(),
        student_id: $('#student_id').val(),
        student_name: $('#student_name').val()
    };
    
    $.ajax({
        url: `${API_BASE_URL}/students`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(student),
        xhrFields: { withCredentials: true },
        success: function() {
            showNotification('Student added successfully', 'success');
            $('#studentForm')[0].reset();
            loadStudents();
            loadDashboardStats();
        },
        error: function(xhr) {
            const error = xhr.responseJSON?.error || 'Failed to add student';
            showNotification(error, 'danger');
        }
    });
}

// Delete student
function deleteStudent(id) {
    if (!confirm('Are you sure you want to delete this student?')) return;
    
    $.ajax({
        url: `${API_BASE_URL}/students/${id}`,
        method: 'DELETE',
        xhrFields: { withCredentials: true },
        success: function() {
            showNotification('Student deleted', 'success');
            loadStudents();
            loadDashboardStats();
        },
        error: function() {
            showNotification('Failed to delete student', 'danger');
        }
    });
}

// Load attendance records
function loadAttendanceRecords() {
    if (!$('#attendanceTable').length) return;
    
    let url = `${API_BASE_URL}/attendance`;
    const params = [];
    
    const startDate = $('#start_date').val();
    const endDate = $('#end_date').val();
    const studentId = $('#student_filter').val();
    
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    if (studentId) params.push(`student_id=${studentId}`);
    
    if (params.length) url += '?' + params.join('&');
    
    $.ajax({
        url: url,
        method: 'GET',
        xhrFields: { withCredentials: true },
        success: function(records) {
            const tbody = $('#attendanceTable tbody');
            tbody.empty();
            
            records.forEach(record => {
                const date = new Date(record.scan_date).toLocaleDateString();
                tbody.append(`
                    <tr>
                        <td>${date}</td>
                        <td>${record.scan_time}</td>
                        <td>${record.student_id}</td>
                        <td>${record.student_name}</td>
                        <td>${record.ic_number}</td>
                        <td><span class="badge bg-success">Present</span></td>
                    </tr>
                `);
            });
            
            if (records.length === 0) {
                tbody.append('<tr><td colspan="6" class="text-center">No records found</td></tr>');
            }
        },
        error: function(xhr) {
            console.error('Error loading attendance:', xhr.responseText);
        }
    });
}

// Load settings
function loadSettings() {
    $.ajax({
        url: `${API_BASE_URL}/settings`,
        method: 'GET',
        xhrFields: { withCredentials: true },
        success: function(settings) {
            settings.forEach(setting => {
                const element = $(`#${setting.setting_key}`);
                if (element.length) {
                    if (element.is(':checkbox')) {
                        element.prop('checked', setting.setting_value === 'true');
                    } else {
                        element.val(setting.setting_value);
                    }
                }
            });
        },
        error: function(xhr) {
            console.error('Error loading settings:', xhr.responseText);
        }
    });
}

// Load holidays
function loadHolidays() {
    const tbody = $('#holidaysTable tbody');
    if (!tbody.length) return;
    
    $.ajax({
        url: `${API_BASE_URL}/holidays`,
        method: 'GET',
        xhrFields: { withCredentials: true },
        success: function(holidays) {
            tbody.empty();
            
            holidays.forEach(holiday => {
                const date = new Date(holiday.holiday_date).toLocaleDateString();
                tbody.append(`
                    <tr>
                        <td>${date}</td>
                        <td>${holiday.description || ''}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-danger delete-holiday" data-id="${holiday.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `);
            });
            
            // Add delete handlers
            $('.delete-holiday').click(function() {
                const holidayId = $(this).data('id');
                deleteHoliday(holidayId);
            });
        },
        error: function(xhr) {
            console.error('Error loading holidays:', xhr.responseText);
        }
    });
}

// Delete holiday
function deleteHoliday(id) {
    if (!confirm('Are you sure you want to delete this holiday?')) return;
    
    $.ajax({
        url: `${API_BASE_URL}/holidays/${id}`,
        method: 'DELETE',
        xhrFields: { withCredentials: true },
        success: function() {
            showNotification('Holiday deleted', 'success');
            loadHolidays();
        },
        error: function() {
            showNotification('Failed to delete holiday', 'danger');
        }
    });
}

// Show notification
function showNotification(message, type = 'info') {
    const container = $('#notification-container');
    const toast = $(`
        <div class="alert alert-${type} alert-dismissible fade show">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `);
    
    container.append(toast);
    
    setTimeout(() => {
        toast.fadeOut(() => toast.remove());
    }, 3000);
}