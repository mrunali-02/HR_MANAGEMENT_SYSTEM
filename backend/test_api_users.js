async function testApi() {
    try {
        const res = await fetch('http://localhost:3001/api/admin/users');
        const data = await res.json();
        console.log('API Status:', res.status);
        console.log('Users Count:', data.users ? data.users.length : 'undefined');
        if (data.users && data.users.length > 0) {
            console.log('First User:', data.users[0]);
        } else {
            console.log('Full Response:', data);
        }
    } catch (err) {
        console.error('Fetch Error:', err);
    }
}

testApi();
