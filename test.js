const Symetrix = require('./symetrix.js');

this.sym = new Symetrix({ host: '172.16.10.200' });

this.sym.on('connected', () => {
    this.sym.on('push', (data) => {
        console.log('Push received from Symetrix', data);
    });

    this.sym
        .pushState(true)
        .then((data) => {
            console.log('push state:', data);
        })
        .catch((err) => console.log(err));

    this.sym
        .controlGet(1000)
        .then((data) => {
            console.log('get:', data);
        })
        .catch((err) => console.log(err));

    this.sym
        .pushRefresh()
        .then((data) => {
            console.log('refresh push:', data);
        })
        .catch((err) => console.log(err));

    this.sym
        .controlGetBlock(1000, 10)
        .then((data) => {
            console.log('get block:', data);
        })
        .catch((err) => console.log(err));

    this.sym
        .flashUnit()
        .then((data) => {
            console.log('flash:', data);
        })
        .catch((err) => console.log(err));
});
