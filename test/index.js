'use strict';

const Lab = require('lab');
const Code = require('code');
const Hapi = require('hapi');
const Hoek = require('hoek');

const lab = exports.lab = Lab.script();
const describe = lab.experiment;
const it = lab.it;
const expect = Code.expect;


const internals = {
    dbOptions: {
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'test'
    }
};

internals.insertHandler = function (request, reply) {

    const sql = 'INSERT INTO test SET id = null';

    expect(request.app.db, 'db connection').to.exist();

    request.app.db.query(sql, (err, results) => {

        expect(err, 'error').to.not.exist();
        expect(results.insertId, 'insert Id').to.exist();

        return reply(results.affectedRows);
    });
};

internals.selectHandler = function (request, reply) {

    const sql = 'SELECT * FROM test';

    expect(request.app.db, 'db connection').to.exist();

    request.app.db.query(sql, (err, results) => {

        expect(err, 'error').to.not.exist();

        return reply(results);
    });
};


describe('Hapi MySQL', () => {

    describe('Basics', () => {

        it('Makes a db connection that works', (done) => {

            const options = Hoek.clone(internals.dbOptions);

            const server = new Hapi.Server();
            server.connection();

            server.register({
                register: require('../'),
                options: options
            }, (err) => {

                expect(err).to.not.exist();

                server.route([{
                    method: 'POST',
                    path: '/test',
                    config: {
                        handler: internals.insertHandler
                    }
                }, {
                    method: 'GET',
                    path: '/test',
                    config: {
                        handler: internals.selectHandler
                    }
                }]);

                server.inject({
                    method: 'POST',
                    url: '/test'
                }, (response) => {

                    expect(response.statusCode, 'post status code').to.equal(200);
                    expect(response.result, 'post result').to.be.above(0);

                    server.inject({
                        method: 'GET',
                        url: '/test'
                    }, (getResponse) => {

                        expect(getResponse.statusCode, 'get status code').to.equal(200);
                        expect(getResponse.result.length, 'get result').to.be.above(0);

                        server.stop(done);
                    });
                });
            });
        });

        it('Quite fail when connection is deleted', (done) => {

            const options = Hoek.clone(internals.dbOptions);

            const server = new Hapi.Server();
            server.connection();

            server.register({
                register: require('../'),
                options: options
            }, (err) => {

                expect(err).to.not.exist();

                server.route([{
                    method: 'GET',
                    path: '/test',
                    config: {
                        handler: (request, reply) => {

                            request.app.db = undefined;
                            return reply('ok');
                        }
                    }
                }]);

                server.inject({
                    method: 'GET',
                    url: '/test'
                }, (response) => {

                    expect(response.statusCode, 'post status code').to.equal(200);
                    expect(response.result, 'post result').to.equal('ok');

                    server.stop(done);
                });
            });
        });

        it('Pool is set to null on Server.stop()', (done) => {

            const options = Hoek.clone(internals.dbOptions);

            const server = new Hapi.Server();
            server.connection();

            server.register({
                register: require('../'),
                options: options
            }, (err) => {

                expect(err).to.not.exist();

                server.start((err) => {

                    expect(err).to.not.exist();

                    server.stop(() => {

                        setImmediate(done);
                    });
                });
            });
        });
    });

    describe('Extras', () => {

        it('Exposes getDb on the server', (done) => {

            const options = Hoek.clone(internals.dbOptions);

            const server = new Hapi.Server();
            server.connection();

            server.register({
                register: require('../'),
                options: options
            }, (err) => {

                expect(err).to.not.exist();
                expect(server.getDb, 'getDb').to.exist();

                server.getDb((err, db) => {

                    expect(err).to.not.exist();
                    expect(db, 'db').to.exist();

                    server.stop(done);
                });
            });
        });

        it('Only registers once', (done) => {

            const options = Hoek.clone(internals.dbOptions);

            const server = new Hapi.Server();
            server.connection();

            server.register([
                {
                    register: require('../'),
                    options: options
                }, {
                    register: require('../'),
                    options: options
                }
            ], (err) => {

                expect(err).to.not.exist();

                server.start((err) => {

                    expect(err).to.not.exist();
                    expect(server.registrations['hapi-plugin-mysql']).to.be.an.object();

                    done();
                });
            });
        });
    });
});
