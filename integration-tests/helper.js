const path = require('path');
const exec = require('child_process').exec;

const dockerComposeFilePath = path.join(process.cwd(), 'integration-tests', 'docker-compose.yml');

module.exports = {
  'getExternalPort': async(service, port) => {
    return new Promise((resolve, reject) => {
      const command = `docker-compose -f "${dockerComposeFilePath}" port ${service} ${port}`;
      exec(command, (error, stdout) => {
        if (error) {
          return reject(error);
        }
        resolve(parseInt(stdout.split(':')[1].replace('\n', ''), 10));
      });
    });
  },
  'getHost': async() => {
    return new Promise((resolve) => {
      const command = 'docker inspect -f "{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}" ' +
        '$(basename "$(cat /proc/1/cgroup | grep docker)")';
      exec(command, (error, stdout) => {
        if (error) {
          return resolve('127.0.0.1');
        }
        return resolve(stdout.replace('\n', ''));
      });
    });
  },
};
