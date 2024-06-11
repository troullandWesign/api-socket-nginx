
    const ws = new WebSocket('ws://thomas.roulland.caen.mds-project.fr:3000/');
    const map = L.map('map').setView([46.603354, 1.888334], 6); // Centre de la France

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const usernameInput = document.getElementById('username');
    const addUserButton = document.getElementById('add-user');
    const userListDiv = document.getElementById('user-list');
    const accelerometerDataDiv = document.getElementById('accelerometer-data');

    let username;
    let markers = {};
    let currentPosition = null;

    addUserButton.addEventListener('click', () => {
        username = usernameInput.value.trim();
        if (username) {
            navigator.geolocation.getCurrentPosition(position => {
                currentPosition = position.coords;
                const { latitude, longitude } = currentPosition;
                fetch('/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: username, position: { lat: latitude, lon: longitude } })
                }).then(response => response.json())
                  .then(data => {
                      console.log('User added:', data);
                      fetchUsersAndUpdate();
                  });
            });
        }
    });

    function fetchUsersAndUpdate() {
        fetch('/users')
            .then(response => response.json())
            .then(users => {
                console.log('Fetched users:', users);
                updateUserList(users);
                updateMapMarkers(users);
            });
    }

    function updateUserList(users) {
        console.log('Updating user list:', users);
        userListDiv.innerHTML = '<h3>Active Users:</h3>';
        users.forEach(user => {
            if (user) {
                const deleteUserButton = `<span class="delete-user" data-id="${user.id}">&times;</span>`;
                userListDiv.innerHTML += `<p>${user.username} - Lat: ${user.latitude}, Lon: ${user.longitude} ${deleteUserButton}</p>`;
            }
        });
    }

    userListDiv.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-user')) {
            const userId = event.target.dataset.id;
            deleteUser(userId);
        }
    });

    function updateMapMarkers(users) {
        console.log('Updating map markers:', users);
        let lastUser;
        for (const marker of Object.values(markers)) {
            map.removeLayer(marker);
        }
        markers = {};
        users.forEach(user => {
            if (user) {
                const { latitude, longitude } = user;
                const marker = L.marker([latitude, longitude]).addTo(map)
                    .bindPopup(`${user.username}<br>Lat: ${latitude}<br>Lon: ${longitude}`)
                    .openPopup();
                markers[user.username] = marker;
                lastUser = user;
            }
        });
        if (lastUser) {
            const { latitude, longitude } = lastUser;
            map.setView([latitude, longitude], 9);
            const circle = L.circle([latitude, longitude], {
                color: 'blue',
                fillColor: '#30f',
                fillOpacity: 0.2,
                radius: 15000 // 15 km
            }).addTo(map);
        }
    }

    function deleteUser(userId) {
        console.log('Deleting user:', userId);
        fetch(`/users/${userId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log(data.message);
            fetchUsersAndUpdate();
        })
        .catch(error => {
            console.error('Error deleting user:', error);
        });
    }

    fetchUsersAndUpdate();

    if ('Accelerometer' in window) {
        const accelerometer = new Accelerometer({ frequency: 1 });
        accelerometer.addEventListener('reading', () => {
            accelerometerDataDiv.innerHTML = `
                <h3>Accelerometer Data:</h3>
                <p>X: ${accelerometer.x.toFixed(2)}</p>
                <p>Y: ${accelerometer.y.toFixed(2)}</p>
                <p>Z: ${accelerometer.z.toFixed(2)}</p>
            `;
        });
        accelerometer.start();
    } else {
        accelerometerDataDiv.innerHTML = '<p>Accelerometer not supported</p>';
    }
