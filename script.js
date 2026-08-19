const elements = {
    days: document.getElementById('days'),
    hours: document.getElementById('hours'),
    minutes: document.getElementById('minutes'),
    seconds: document.getElementById('seconds'),
    countdownWrapper: document.getElementById('countdown-wrapper'),
    celebration: document.getElementById('celebration'),
    celebrationMessage: document.getElementById('celebration-message'),
    timezoneTime: document.getElementById('timezone-current-time'),
    
    detailedSection: document.getElementById('detailed-section'),
    monthsDetail: document.getElementById('months-detail'),
    weeksDetail: document.getElementById('weeks-detail'),
    hoursDetail: document.getElementById('hours-detail'),
    minutesDetail: document.getElementById('minutes-detail'),
    
    datePickerForm: document.getElementById('date-picker-form'),
    datePickerInput: document.getElementById('target-date-picker'),
    timezoneSelect: document.getElementById('timezone-select'),
    targetTimezoneLabel: document.getElementById('target-timezone-label'),
    btnReset: document.getElementById('btn-reset'),
    subtitle: document.querySelector('.subtitle'),
    calendarToggle: document.getElementById('calendar-toggle'),
    calendarPanel: document.getElementById('calendar-panel'),
    calendarStartDate: document.getElementById('calendar-start-date'),
    calendarTargetDate: document.getElementById('calendar-target-date'),
    calendarStartLabel: document.getElementById('calendar-start-label'),
    calendarMidLabel: document.getElementById('calendar-mid-label'),
    calendarEndLabel: document.getElementById('calendar-end-label'),
    calendarGrid: document.getElementById('calendar-grid'),
    eventsList: document.getElementById('events-list'),
    openEventModalBtn: document.getElementById('open-event-modal-btn'),
    eventModalBackdrop: document.getElementById('event-modal-backdrop'),
    eventModalClose: document.getElementById('event-modal-close'),
    eventModalKicker: document.querySelector('#event-modal-backdrop .section-kicker'),
    eventModalTitle: document.getElementById('event-modal-title'),
    eventModalForm: document.getElementById('event-modal-form'),
    modalEventNameInput: document.getElementById('modal-event-name'),
    modalEventDateLabel: document.getElementById('modal-event-date-label'),
    modalEventDateInput: document.getElementById('modal-event-date'),
    modalRepeatWeekly: document.getElementById('modal-repeat-weekly'),
    modalRepeatWeekday: document.getElementById('modal-repeat-weekday'),
    modalRepeatUntil: document.getElementById('modal-repeat-until'),
    modalEventStartInput: document.getElementById('modal-event-start'),
    modalEventEndInput: document.getElementById('modal-event-end')
};

elements.calendarToggle?.setAttribute('aria-controls', 'calendar-panel');

const lastValues = {
    days: null,
    hours: null,
    minutes: null,
    seconds: null,
    monthsDetail: null,
    weeksDetail: null,
    hoursDetail: null,
    minutesDetail: null
};

const timezoneLabels = {
    'America/Caracas': 'Venezuela (Caracas, UTC-4)',
    'America/Bogota': 'Colombia / Perú (Bogota, UTC-5)',
    'America/Argentina/Buenos_Aires': 'Argentina (Buenos Aires, UTC-3)',
    'America/Mexico_City': 'México (CDMX, UTC-6)',
    'America/New_York': 'EE.UU. Este (Nueva York, UTC-5/UTC-4)',
    'Europe/Madrid': 'España (Madrid, UTC+1/UTC+2)',
    'UTC': 'Coordinated Universal Time (UTC)',
    'local': 'Tu Zona Horaria Local'
};

let currentTimezone;
let targetDateString;
let targetTimestamp;
let editingEventId = null;
let openEventSettingsId = null;
let lastEventsRenderAt = 0;
let modalTriggerElement = null;
const EVENT_STORAGE_KEY = 'custom-events';
const EVENTS_RENDER_INTERVAL = 5000;

function getVenezuelaDefaultYear() {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const defaultTargetUtc = new Date(Date.UTC(currentYear, 9, 3, 4, 0, 0)).getTime();
    
    if (now.getTime() > defaultTargetUtc) {
        return currentYear + 1;
    }
    return currentYear;
}


function formatDateForInput(date) {
    const pad = num => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}


function getTimestampInTimezone(dateTimeStr, timeZone) {
    if (timeZone === 'local') {
        return new Date(dateTimeStr).getTime();
    }
    
    const [datePart, timePart] = dateTimeStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
        });
        
        const parts = formatter.formatToParts(utcDate);
        const map = {};
        parts.forEach(p => { map[p.type] = p.value; });
        
        const targetLocal = new Date(Date.UTC(
            Number(map.year),
            Number(map.month) - 1,
            Number(map.day),
            Number(map.hour),
            Number(map.minute),
            Number(map.second)
        ));
        
        const offset = utcDate.getTime() - targetLocal.getTime();
        return utcDate.getTime() + offset;
    } catch (e) {
        console.error("Timezone offset calculation error, falling back to browser parser:", e);
        return new Date(dateTimeStr).getTime();
    }
}


function getTargetTimeFormatted() {
    const options = {
        timeZone: currentTimezone === 'local' ? undefined : currentTimezone,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    };
    try {
        const formatter = new Intl.DateTimeFormat('es-VE', options);
        return formatter.format(new Date());
    } catch (e) {
        return new Date().toLocaleString();
    }
}

function calculateMonths(diffMilliseconds) {
    const averageMonthMs = 1000 * 60 * 60 * 24 * 30.436875; // Promedio de días por mes
    return Math.max(0, diffMilliseconds / averageMonthMs);
}

function formatTargetDateLabel(date) {
    const options = { dateStyle: 'long', timeStyle: 'short' };
    return date.toLocaleString('es-VE', options);
}

function showNoTargetState() {
    elements.subtitle.textContent = 'Destino: fecha no seleccionada';
    elements.countdownWrapper.style.display = 'none';
    elements.detailedSection.style.display = 'none';
    elements.celebration.style.display = 'none';
}

function updateTargetTimestamp() {
    if (!targetDateString) {
        targetTimestamp = null;
        elements.targetTimezoneLabel.textContent = timezoneLabels[currentTimezone] || currentTimezone;
        showNoTargetState();
        updateCalendarPanel();
        return;
    }

    targetTimestamp = getTimestampInTimezone(targetDateString, currentTimezone);
    
    elements.targetTimezoneLabel.textContent = timezoneLabels[currentTimezone] || currentTimezone;
    
    const date = new Date(targetTimestamp);
    elements.subtitle.textContent = `Destino: ${formatTargetDateLabel(date)}`;
    updateCalendarPanel();
}

function formatDisplayDate(date) {
    const options = {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    };

    try {
        return new Intl.DateTimeFormat('es-ES', options).format(date);
    } catch (e) {
        return date.toLocaleDateString('es-VE', options);
    }
}

function getTodayProgress() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const elapsed = now.getTime() - midnight.getTime();
    const totalDay = 1000 * 60 * 60 * 24;
    const percent = Math.min(100, Math.max(0, Math.round((elapsed / totalDay) * 100)));

    return {
        percent,
        label: `${percent}% completado`
    };
}

function updateCalendarTodayProgress() {
    const todayCard = document.querySelector('.calendar-day-card.current');
    if (!todayCard) {
        return;
    }

    const progressFill = todayCard.querySelector('.day-progress-fill');
    const progressLabel = todayCard.querySelector('.day-progress-label');
    const { percent, label } = getTodayProgress();

    if (progressFill) {
        progressFill.style.width = `${percent}%`;
    }
    if (progressLabel) {
        progressLabel.textContent = label;
    }
}

function formatLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function renderCalendarDayCards(startDate, endDate, referenceDate) {
    const cards = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const target = new Date(endDate);
    target.setHours(0, 0, 0, 0);

    if (current.getTime() > target.getTime()) {
        return '<p class="calendar-empty">La fecha objetivo es anterior a la fecha actual.</p>';
    }

    const dayFormatter = new Intl.DateTimeFormat('es-ES', {
        weekday: 'short',
        day: '2-digit',
        month: 'short'
    });
    const monthHues = [0, 330, 280, 220, 160, 120, 80, 40, 30, 15, 10, 200]; // hues per month (Jan..Dec)
    const msPerDay = 1000 * 60 * 60 * 24;
    const startMidnight = new Date(startDate);
    startMidnight.setHours(0, 0, 0, 0);
    const totalRangeDays = Math.max(1, Math.ceil((target.getTime() - startMidnight.getTime()) / msPerDay));

    let dayIndex = 0;
    const todayMidnight = new Date(referenceDate);
    todayMidnight.setHours(0, 0, 0, 0);
    const dayProgress = getTodayProgress().percent;
    

    while (current.getTime() <= target.getTime()) {
        const label = dayFormatter.format(current);
        const isToday = current.getTime() === todayMidnight.getTime();
        const isTarget = current.getTime() === target.getTime();
        const isWeekly = dayIndex > 0 && dayIndex % 7 === 0 && current.getTime() !== target.getTime();
        const displayDay = String(current.getDate()).padStart(2, '0');
        const cardType = isToday ? 'Hoy' : isTarget ? 'Meta' : isWeekly ? `Semana ${Math.floor(dayIndex / 7)}` : 'Día';
        const progress = isToday ? dayProgress : current.getTime() < todayMidnight.getTime() ? 100 : 0;
        const progressLabel = isToday ? `${progress}% completado` : current.getTime() < todayMidnight.getTime() ? 'Terminado' : 'Pendiente';

        const monthIdx = current.getMonth();
        const hue = monthHues[monthIdx % monthHues.length];
        const daysUntilTarget = Math.ceil((target.getTime() - current.getTime()) / msPerDay);
        const closeness = 1 - Math.min(1, Math.max(0, daysUntilTarget / totalRangeDays)); 
        const lightMin = 32; 
        const lightMax = 78; 
        const lightness = Math.round(lightMin + closeness * (lightMax - lightMin));
        const saturation = 62; 
        const bgLightness = Math.max(18, lightness - 8);
        const bgAlpha = 0.14;
        const borderLightness = Math.max(22, lightness - 4);
        const borderAlpha = 0.28;
        const bg = `hsla(${hue}, ${saturation}%, ${bgLightness}%, ${bgAlpha})`;
        const borderCol = `hsla(${hue}, ${Math.min(80, saturation + 6)}%, ${borderLightness}%, ${borderAlpha})`;
        const progressGradient = `linear-gradient(135deg, hsla(${hue}, ${saturation}%, ${Math.min(92, lightness + 12)}%, 0.95), hsla(${hue}, ${saturation}%, ${Math.max(16, lightness - 6)}%, 0.9))`;
        const textColor = lightness > 60 ? '#102230' : '#ffffff';

        cards.push(`
            <div class="calendar-day-card ${isToday ? 'current' : ''} ${isTarget ? 'target' : ''} ${isWeekly ? 'weekly' : ''}" data-date="${formatLocalDateKey(current)}" role="button" tabindex="0" aria-label="Abrir evento para ${label}" style="--progress: ${progress}%; --calendar-card-bg: ${bg}; --calendar-card-border: ${borderCol}; --progress-gradient: ${progressGradient}; --calendar-card-text: ${textColor};">
                <span>${cardType}</span>
                <strong>${displayDay}</strong>
                <span>${label}</span>
                <div class="day-progress" aria-hidden="true">
                    <div class="day-progress-fill"></div>
                </div>
                <span class="day-progress-label">${progressLabel}</span>
            </div>
        `);

        current.setDate(current.getDate() + 1);
        dayIndex += 1;
    }

    return cards.join('');
}

function updateCalendarPanel() {
    const now = new Date();
    elements.calendarStartDate.textContent = formatDisplayDate(now);
    elements.calendarStartLabel.textContent = 'Hoy';
    elements.calendarEndLabel.textContent = targetTimestamp ? formatDisplayDate(new Date(targetTimestamp)) : 'Meta pendiente';

    if (!targetTimestamp) {
        elements.calendarTargetDate.textContent = 'Fecha no seleccionada';
        elements.calendarMidLabel.textContent = 'Elige una fecha para activar el recorrido';
        const oldScrollTop = elements.calendarGrid.scrollTop;
        elements.calendarGrid.innerHTML = '<p class="calendar-empty">Selecciona una fecha para ver el recorrido completo.</p>';
        elements.calendarGrid.scrollTop = oldScrollTop;
        return;
    }

    const targetDate = new Date(targetTimestamp);
    elements.calendarTargetDate.textContent = formatDisplayDate(targetDate);

    const diffDays = Math.ceil((targetTimestamp - now.getTime()) / (1000 * 60 * 60 * 24));
    elements.calendarMidLabel.textContent = diffDays > 0 ? `${diffDays} días de recorrido` : 'Fecha actual o pasada';

    const dayCards = renderCalendarDayCards(now, targetDate, now);
    const oldScrollTop = elements.calendarGrid.scrollTop;
    elements.calendarGrid.innerHTML = dayCards;
    elements.calendarGrid.scrollTop = oldScrollTop;

    elements.calendarGrid.querySelectorAll('.calendar-day-card').forEach((card) => {
        const openForDay = () => openEventModal(card.dataset.date);
        card.addEventListener('click', openForDay);
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openForDay();
            }
        });
    });
}


function updateDigit(element, value, key) {
    const formatted = String(value).padStart(2, '0');
    if (lastValues[key] !== formatted) {
        element.textContent = formatted;
        lastValues[key] = formatted;
        
        element.classList.remove('number-pop');
        void element.offsetWidth; 
        element.classList.add('number-pop');
    }
}

function updateDigitFormatted(element, value, key) {
    const numericValue = Number(value);
    const options = {
        maximumFractionDigits: (key === 'monthsDetail' || key === 'weeksDetail') ? 1 : 0,
        minimumFractionDigits: (key === 'monthsDetail' || key === 'weeksDetail') ? 1 : 0
    };
    const locale = (key === 'monthsDetail' || key === 'weeksDetail') ? 'en-US' : 'es-VE';
    const formatted = numericValue.toLocaleString(locale, options);
    if (lastValues[key] !== formatted) {
        element.textContent = formatted;
        lastValues[key] = formatted;
        
        element.classList.remove('number-pop');
        void element.offsetWidth; 
        element.classList.add('number-pop');
    }
}

function updateCountdown() {
    const nowObj = new Date();
    const now = nowObj.getTime();

    if (targetTimestamp) {
        const diff = targetTimestamp - now;

        elements.timezoneTime.textContent = getTargetTimeFormatted();
        
        if (diff <= 0) {
            elements.countdownWrapper.style.display = 'none';
            elements.detailedSection.style.display = 'none';
            elements.celebration.style.display = 'block';
            
            const targetDate = new Date(targetTimestamp);
            elements.celebrationMessage.textContent = `El evento programado para ${formatTargetDateLabel(targetDate)} ya ha comenzado.`;
        } else {
            elements.countdownWrapper.style.display = 'grid';
            elements.detailedSection.style.display = 'block';
            elements.celebration.style.display = 'none';
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            const months = calculateMonths(diff);
            const weeks = diff / (1000 * 60 * 60 * 24 * 7);
            const totalHours = Math.floor(diff / (1000 * 60 * 60));
            const totalMinutes = Math.floor(diff / (1000 * 60));
            
            updateDigit(elements.days, days, 'days');
            updateDigit(elements.hours, hours, 'hours');
            updateDigit(elements.minutes, minutes, 'minutes');
            updateDigit(elements.seconds, seconds, 'seconds');
            
            updateDigitFormatted(elements.monthsDetail, months, 'monthsDetail');
            updateDigitFormatted(elements.weeksDetail, weeks, 'weeksDetail');
            updateDigitFormatted(elements.hoursDetail, totalHours, 'hoursDetail');
            updateDigitFormatted(elements.minutesDetail, totalMinutes, 'minutesDetail');
        }
    }

    if (elements.calendarPanel.classList.contains('open')) {
        updateCalendarTodayProgress();
    }

    if (Date.now() - lastEventsRenderAt >= EVENTS_RENDER_INTERVAL) {
        renderEvents();
    }
}

function getEventsFromStorage() {
    try {
        const savedEvents = JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY) || '[]');
        return Array.isArray(savedEvents) ? savedEvents : [];
    } catch (error) {
        console.error('No se pudieron cargar los eventos guardados:', error);
        return [];
    }
}

function saveEvents(events) {
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(events));
}

function formatDurationText(minutes) {
    if (minutes <= 0) return '0 min';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours === 0) {
        return `${remainingMinutes} min`;
    }

    if (remainingMinutes === 0) {
        return `${hours} h`;
    }

    return `${hours} h ${remainingMinutes} min`;
}

function formatRemainingText(targetTimestampMs) {
    const diffMs = targetTimestampMs - Date.now();

    if (diffMs <= 0) {
        return 'Evento en curso o ya finalizado';
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / (60 * 60 * 24));
    const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days} día${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hora${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} min`);

    if (parts.length === 0) {
        return 'Menos de 1 minuto';
    }

    return `${parts.join(', ')} restantes`;
}

function getWeeklyProgressRange(nextOccurrence) {
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const nextTimestamp = nextOccurrence.getTime();

    return {
        start: nextTimestamp - weekMs,
        end: nextTimestamp
    };
}

function renderEvents() {
    const events = getEventsFromStorage();
    lastEventsRenderAt = Date.now();
    const openMenu = elements.eventsList.querySelector('.event-settings-menu:not([hidden])');
    const openEventCard = openMenu?.closest('.event-card');
    const preservedOpenEventId = openEventCard?.dataset.eventId || openEventSettingsId;

    if (!events.length) {
        elements.eventsList.innerHTML = `
            <div class="event-empty-state">
                <p>No tienes eventos agregados todavía.</p>
                <span>Usa el formulario para crear tu próxima cita o reunión.</span>
            </div>
        `;
        return;
    }

    const displayEvents = events.map((event) => {
        if (isWeeklyRecurringEvent(event)) {
            const weekdayName = getWeekdayLabel(event.repeatWeekday);
            const startDate = new Date(`${event.date}T${event.start}:00`);
            const endDate = new Date(`${event.date}T${event.end}:00`);
            const totalMinutes = Math.max(0, (endDate.getTime() - startDate.getTime()) / 60000);
            let nextOccurrence = new Date(startDate);
            const limitDate = event.repeatUntil ? new Date(`${event.repeatUntil}T23:59:59`) : null;
            const currentDay = new Date();
            const eventName = (event.name || '').trim() || 'Evento recurrente';
            let hasNextOccurrence = !limitDate || nextOccurrence <= limitDate;

            if (currentDay > startDate) {
                const adjusted = new Date(startDate);
                const diff = (currentDay.getDay() - event.repeatWeekday + 7) % 7;
                adjusted.setDate(currentDay.getDate() + diff);
                if (adjusted < currentDay) {
                    adjusted.setDate(adjusted.getDate() + 7);
                }
                if (!limitDate || adjusted <= limitDate) {
                    nextOccurrence.setTime(adjusted.getTime());
                } else {
                    hasNextOccurrence = false;
                }
            }

            const nextRemainingText = hasNextOccurrence
                ? formatRemainingText(nextOccurrence.getTime())
                : 'No hay más repeticiones';
            const progressRange = getWeeklyProgressRange(nextOccurrence);

            return {
                ...event,
                displayTitle: eventName,
                description: `${startDate.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`,
                dateLabel: event.repeatUntil ? `Desde ${startDate.toLocaleDateString('es-VE', { dateStyle: 'medium' })} hasta ${new Date(`${event.repeatUntil}T23:59:59`).toLocaleDateString('es-VE', { dateStyle: 'medium' })}` : `Desde ${startDate.toLocaleDateString('es-VE', { dateStyle: 'medium' })}`,
                durationLabel: formatDurationText(totalMinutes),
                remainingLabel: nextRemainingText,
                recurrenceLabel: `Todos los ${weekdayName}`,
                repeatUntilLabel: event.repeatUntil ? `Hasta ${new Date(`${event.repeatUntil}T23:59:59`).toLocaleDateString('es-VE', { dateStyle: 'medium' })}` : 'Sin fecha límite',
                isRecurring: true,
                progressStartTimestamp: progressRange.start,
                progressEndTimestamp: progressRange.end,
                sortTimestamp: hasNextOccurrence ? nextOccurrence.getTime() : Number.POSITIVE_INFINITY
            };
        }

        const startDate = new Date(`${event.date}T${event.start}:00`);
        const endDate = new Date(`${event.date}T${event.end}:00`);
        const totalMinutes = Math.max(0, (endDate.getTime() - startDate.getTime()) / 60000);
        const eventName = (event.name || '').trim() || 'Evento';
        const progressRange = getWeeklyProgressRange(startDate);

        return {
            ...event,
            displayTitle: eventName,
            description: `${startDate.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`,
            dateLabel: startDate.toLocaleDateString('es-VE', { dateStyle: 'medium' }),
            durationLabel: formatDurationText(totalMinutes),
            remainingLabel: formatRemainingText(startDate.getTime()),
            recurrenceLabel: 'Único',
            repeatUntilLabel: '',
            isRecurring: false,
            progressStartTimestamp: progressRange.start,
            progressEndTimestamp: progressRange.end,
            sortTimestamp: startDate.getTime()
        };
    });

    displayEvents.sort((firstEvent, secondEvent) => firstEvent.sortTimestamp - secondEvent.sortTimestamp);

    elements.eventsList.innerHTML = displayEvents.map((event) => {
        const progressDuration = event.progressEndTimestamp - event.progressStartTimestamp;
        const progress = progressDuration > 0
            ? ((Date.now() - event.progressStartTimestamp) / progressDuration) * 100
            : 100;

        const progressStyle = `width: ${Math.min(100, Math.max(0, progress))}%`;
        const metaBadge = event.isRecurring ? 'Recurrente' : 'Evento';

        const remainingLabelText = event.isRecurring ? 'La próxima será en:' : 'Tiempo restante:';

        return `
            <article class="event-card" data-event-id="${event.id}">
                <div class="event-card-header">
                    <div>
                        <p class="event-badge">${metaBadge}</p>
                        <h4>${event.displayTitle}</h4>
                    </div>
                    <div class="event-settings">
                        <button class="event-settings-toggle" type="button" aria-expanded="false" aria-label="Abrir ajustes de ${event.displayTitle}">Ajustes</button>
                        <div class="event-settings-menu" hidden>
                            <button class="event-edit" data-event-id="${event.id}" type="button">Editar</button>
                            <button class="event-delete" data-event-id="${event.id}" type="button">Eliminar</button>
                        </div>
                    </div>
                </div>

                <div class="event-meta-list">
                    <span><strong>Fecha:</strong> ${event.dateLabel}</span>
                    <span><strong>Horario:</strong> ${event.description}</span>
                    <span><strong>Duración:</strong> ${event.durationLabel}</span>
                    <span><strong>Recurrencia:</strong> ${event.recurrenceLabel}</span>
                    ${event.repeatUntilLabel ? `<span><strong>Hasta:</strong> ${event.repeatUntilLabel}</span>` : ''}
                    <span><strong>${remainingLabelText}</strong> ${event.remainingLabel}</span>
                </div>

                <div class="event-progress" aria-hidden="true">
                    <div class="event-progress-fill" style="${progressStyle}"></div>
                </div>
            </article>
        `;
    }).join('');

    if (preservedOpenEventId) {
        const restoredCard = elements.eventsList.querySelector(`.event-card[data-event-id="${preservedOpenEventId}"]`);
        const restoredMenu = restoredCard?.querySelector('.event-settings-menu');
        const restoredToggle = restoredCard?.querySelector('.event-settings-toggle');
        if (restoredMenu && restoredToggle) {
            restoredMenu.hidden = false;
            restoredToggle.setAttribute('aria-expanded', 'true');
            openEventSettingsId = preservedOpenEventId;
        }
    }

    elements.eventsList.querySelectorAll('.event-settings-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const menu = button.nextElementSibling;
            const isOpen = !menu.hidden;
            elements.eventsList.querySelectorAll('.event-settings-menu').forEach(item => {
                item.hidden = true;
            });
            elements.eventsList.querySelectorAll('.event-settings-toggle').forEach(item => {
                item.setAttribute('aria-expanded', 'false');
            });
            menu.hidden = isOpen;
            button.setAttribute('aria-expanded', String(!isOpen));
            openEventSettingsId = isOpen ? null : button.closest('.event-card').dataset.eventId;
        });
    });

    elements.eventsList.querySelectorAll('.event-edit').forEach(button => {
        button.addEventListener('click', () => {
            const eventId = Number(button.dataset.eventId);
            const selectedEvent = getEventsFromStorage().find(event => event.id === eventId);
            if (selectedEvent) {
                openEventSettingsId = null;
                openEventModal(selectedEvent.date, true, selectedEvent);
            }
        });
    });

    elements.eventsList.querySelectorAll('.event-delete').forEach(button => {
        button.addEventListener('click', () => {
            const eventId = Number(button.dataset.eventId);
            const updatedEvents = getEventsFromStorage().filter(event => event.id !== eventId);
            saveEvents(updatedEvents);
            openEventSettingsId = null;
            renderEvents();
        });
    });
}

function initializeEventFormDefaults() {
    const today = new Date();
    const formattedToday = today.toISOString().split('T')[0];
    if (elements.modalEventDateInput) {
        elements.modalEventDateInput.value = formattedToday;
    }
}

function addDays(dateString, days) {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

function toggleRepeatOptions() {
    const showOptions = elements.modalRepeatWeekly.checked;
    const repeatFields = document.querySelectorAll('.hidden-repeat-option');

    repeatFields.forEach((field) => {
        field.style.display = showOptions ? 'flex' : 'none';
    });
}

function openEventModal(dateValue = '', allowDateEdit = false, eventToEdit = null) {
    const selectedDate = dateValue || new Date().toISOString().split('T')[0];
    const parsedDate = new Date(`${selectedDate}T00:00:00`);
    const defaultUntilDate = addDays(selectedDate, 90);
    editingEventId = eventToEdit ? eventToEdit.id : null;
    modalTriggerElement = document.activeElement;

    if (elements.modalEventDateInput) {
        elements.modalEventDateInput.value = selectedDate;
    }
    elements.modalEventNameInput.value = eventToEdit?.name || '';
    elements.modalRepeatWeekly.checked = Boolean(eventToEdit?.repeatWeekly);
    elements.modalRepeatWeekday.value = String(eventToEdit?.repeatWeekday ?? parsedDate.getDay());
    elements.modalRepeatUntil.value = eventToEdit?.repeatUntil || defaultUntilDate;
    elements.modalEventStartInput.value = eventToEdit?.start || '18:00';
    elements.modalEventEndInput.value = eventToEdit?.end || '20:00';
    elements.eventModalKicker.textContent = eventToEdit ? 'Editar evento' : 'Nuevo evento';
    elements.eventModalTitle.textContent = eventToEdit ? 'Ajustar evento' : 'Agregar evento';

    toggleRepeatOptions();
    elements.eventModalBackdrop.classList.add('visible');
    elements.eventModalBackdrop.setAttribute('aria-hidden', 'false');
    elements.eventModalBackdrop.removeAttribute('inert');
    setTimeout(() => elements.modalEventNameInput.focus(), 80);
}

function closeEventModal() {
    elements.eventModalBackdrop.classList.remove('visible');
    elements.eventModalBackdrop.setAttribute('aria-hidden', 'true');
    elements.eventModalBackdrop.setAttribute('inert', '');
    editingEventId = null;
    elements.eventModalKicker.textContent = 'Nuevo evento';
    elements.eventModalTitle.textContent = 'Agregar evento';
    modalTriggerElement?.focus();
    modalTriggerElement = null;
}

function getWeekdayLabel(weekdayNumber) {
    const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return weekdays[Number(weekdayNumber)] || 'Día';
}

function isWeeklyRecurringEvent(event) {
    return Boolean(event.repeatWeekly && event.repeatWeekday !== undefined && event.repeatWeekday !== null);
}

function saveEventFromInputs({
    name,
    date,
    start,
    end,
    form,
    resetForm,
    repeatWeekly = false,
    repeatWeekday = null,
    repeatUntil = null,
    eventId = null
}) {
    if (!name || !date || !start || !end) {
        return;
    }

    const startDate = new Date(`${date}T${start}:00`);
    const endDate = new Date(`${date}T${end}:00`);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        alert('La hora de fin debe ser mayor que la de inicio.');
        return;
    }

    const events = getEventsFromStorage();
    const existingEvent = eventId ? events.find(event => event.id === eventId) : null;
    const eventData = repeatWeekly && repeatWeekday !== null ? {
        id: eventId || Date.now(),
        name,
        date,
        start,
        end,
        repeatWeekly: true,
        repeatWeekday: Number(repeatWeekday),
        repeatUntil: repeatUntil || null,
        createdAt: existingEvent?.createdAt || Date.now()
    } : {
        id: eventId || Date.now(),
        name,
        date,
        start,
        end,
        createdAt: existingEvent?.createdAt || Date.now()
    };

    if (eventId) {
        const eventIndex = events.findIndex(event => event.id === eventId);
        if (eventIndex !== -1) {
            events[eventIndex] = eventData;
        }
    } else {
        events.push(eventData);
    }
    saveEvents(events);

    if (resetForm) {
        form.reset();
    }
    if (form === elements.eventForm) {
        initializeEventFormDefaults();
    }
    renderEvents();
    closeEventModal();
}

function getSelectedCalendarDateFromModal() {
    if (elements.modalEventDateInput && elements.modalEventDateInput.value) {
        return elements.modalEventDateInput.value;
    }

    return new Date().toISOString().split('T')[0];
}

function initializeSettings() {
    const savedDate = localStorage.getItem('customTargetDate');
    const savedTz = localStorage.getItem('customTargetTimezone');
    
    if (savedDate) {
        targetDateString = savedDate;
    } else {
        targetDateString = '';
    }
    currentTimezone = savedTz || 'America/Caracas';
    
    elements.datePickerInput.value = targetDateString;
    elements.timezoneSelect.value = currentTimezone;
    initializeEventFormDefaults();
    renderEvents();
    updateTargetTimestamp();
    updateCountdown();
}

elements.datePickerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const dateVal = elements.datePickerInput.value;
    const tzVal = elements.timezoneSelect.value;
    
    if (dateVal && tzVal) {
        targetDateString = dateVal;
        currentTimezone = tzVal;
        
        localStorage.setItem('customTargetDate', dateVal);
        localStorage.setItem('customTargetTimezone', tzVal);
        
        updateTargetTimestamp();
        updateCountdown();
    }
});

elements.btnReset.addEventListener('click', () => {
    localStorage.removeItem('customTargetDate');
    localStorage.removeItem('customTargetTimezone');
    
    targetDateString = '';
    currentTimezone = 'America/Caracas';
    
    elements.datePickerInput.value = targetDateString;
    elements.timezoneSelect.value = currentTimezone;
    
    updateTargetTimestamp();
    updateCountdown();
});

elements.calendarToggle.addEventListener('click', () => {
    const isOpen = elements.calendarPanel.classList.toggle('open');
    elements.calendarToggle.classList.toggle('open', isOpen);
    elements.calendarToggle.setAttribute('aria-expanded', String(isOpen));
    elements.calendarPanel.setAttribute('aria-hidden', String(!isOpen));
    if (isOpen) {
        elements.calendarPanel.removeAttribute('inert');
    } else {
        elements.calendarPanel.setAttribute('inert', '');
    }
    if (isOpen) {
        updateCalendarPanel();
    }
});

elements.openEventModalBtn.addEventListener('click', () => {
    openEventModal(new Date().toISOString().split('T')[0], true);
});

elements.eventModalForm.addEventListener('submit', (event) => {
    event.preventDefault();

    saveEventFromInputs({
        name: elements.modalEventNameInput.value.trim(),
        date: getSelectedCalendarDateFromModal(),
        start: elements.modalEventStartInput.value,
        end: elements.modalEventEndInput.value,
        form: elements.eventModalForm,
        resetForm: false,
        repeatWeekly: elements.modalRepeatWeekly.checked,
        repeatWeekday: Number(elements.modalRepeatWeekday.value),
        repeatUntil: elements.modalRepeatUntil.value || null,
        eventId: editingEventId
    });
});

elements.modalRepeatWeekly.addEventListener('change', toggleRepeatOptions);

elements.eventModalClose.addEventListener('click', closeEventModal);
elements.eventModalBackdrop.addEventListener('click', (event) => {
    if (event.target === elements.eventModalBackdrop) {
        closeEventModal();
    }
});

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && elements.eventModalBackdrop.classList.contains('visible')) {
        closeEventModal();
    }
});

initializeSettings();
updateCalendarPanel();
updateCountdown();
setInterval(updateCountdown, 1000);
