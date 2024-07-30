let hideMenuTimeout;

async function showTimetable() {
    const datePicker = document.getElementById("date-picker");
    const selectedDate = datePicker.value;
    const timetableContainer = document.getElementById("timetable");
    const selectedDayContainer = document.getElementById("selected-day");

    timetableContainer.innerHTML = ""; // Clear previous timetable

    if (selectedDate) {
        // Display the selected day
        const date = new Date(selectedDate);
        const options = { weekday: 'long' };
        const selectedDay = date.toLocaleDateString('en-US', options);
        selectedDayContainer.textContent = `${selectedDay}`;
        selectedDayContainer.style.display = 'block';

        try {
            const response = await fetch(`http://localhost:3000/timetable?date=${selectedDate}`);
            const data = await response.json();

            if (data.timetable.length > 0) {
                data.timetable.forEach(entry => {
                    const entryElement = document.createElement("div");
                    entryElement.classList.add("card", "mb-3");
                    entryElement.innerHTML = `
                        <div class="card-body">
                            <h5 class="card-title">${entry.time}</h5>
                            <p class="card-text">${entry.subject}</p>
                            <button class="btn btn-primary summary-button" data-subject="${entry.subject}" oncontextmenu="showContextMenu(event)">View Summary</button>
                        </div>
                    `;

                    timetableContainer.appendChild(entryElement);
                });
            } else {
                timetableContainer.innerHTML = "<div class='alert alert-warning'>No timetable available for this date.</div>";
            }
        } catch (error) {
            console.error('Error fetching timetable:', error);
            timetableContainer.innerHTML = "<div class='alert alert-danger'>Error loading timetable.</div>";
        }
    } else {
        selectedDayContainer.style.display = 'none';
        timetableContainer.innerHTML = "<div class='alert alert-info'>Please select a date to view the timetable.</div>";
    }
}

function showContextMenu(event) {
    event.preventDefault();
    clearTimeout(hideMenuTimeout);

    const subject = event.target.getAttribute('data-subject');

    const contextMenu = document.getElementById('context-menu');
    contextMenu.innerHTML = `<ul>
        <li data-summary-type="one-line">1 line Summary</li>
        <li data-summary-type="five-points">5 points Summary</li>
        <li data-summary-type="paragraph">Paragraph Summary</li>
    </ul>`;

    // Position the context menu
    contextMenu.style.display = 'block';
    const clickX = event.clientX;
    const clickY = event.clientY;
    const menuWidth = contextMenu.offsetWidth;
    const menuHeight = contextMenu.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Ensure the context menu doesn't overflow the window
    const posX = (clickX + menuWidth > windowWidth) ? windowWidth - menuWidth - 5 : clickX;
    const posY = (clickY + menuHeight > windowHeight) ? windowHeight - menuHeight - 5 : clickY;

    contextMenu.style.left = `${posX}px`;
    contextMenu.style.top = `${posY}px`;

    // Add event listeners to the context menu options
    contextMenu.querySelectorAll('li').forEach(item => {
        item.addEventListener('click', () => {
            const summaryType = item.getAttribute('data-summary-type');
            showSummaryPage(summaryType, subject);
            hideContextMenu();
        });
    });

    document.addEventListener('click', hideContextMenu);
}

function hideContextMenu() {
    const contextMenu = document.getElementById('context-menu');
    contextMenu.style.display = 'none';
    document.removeEventListener('click', hideContextMenu);
}

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', hideContextMenu);

    // Summary page script
    if (window.location.pathname.endsWith('summary.html')) {
        fetchSummary();
    }
});

async function fetchSummary() {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');
    const subject = urlParams.get('subject');

    try {
        const response = await fetch(`http://localhost:3000/summary/${type}/${subject}`);
        if (response.ok) {
            const summary = await response.text();
            document.getElementById('summary-content').innerHTML = `Subject: ${subject}<br><br>${summary}`;
        } else {
            document.getElementById('summary-content').textContent = 'Summary not found.';
        }
    } catch (error) {
        console.error('Error fetching summary:', error);
        document.getElementById('summary-content').textContent = 'Error loading summary.';
    }
}

function showSummaryPage(type, subject) {
    window.location.href = `summary.html?type=${type}&subject=${subject}`;
}
