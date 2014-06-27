module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        mochaTest: {
            test: {
                src: ['test/*.js']
            }
        },

        copy: {
            deployTest: { files: [{ src: ['./config/test.online.json'], dest: './test.config.json' }, { src: ['./config/online.web.config'], dest: './web.config' }] },
            deployProd: { files: [{ src: ['./config/production.online.config.json'], dest: './prod.config.json' }, { src: ['./config/online.web.config'], dest: './web.config' }] }
        },

        exec: {
            installJsReport: {
                cmd: "npm install",
                cwd: require("path").join("node_modules", "jsreport")
            },
            buildDev : {
                cmd: "grunt development",
                cwd: require("path").join("node_modules", "jsreport")
            },
            buildProd : {
                cmd: "grunt production",
                cwd: require("path").join("node_modules", "jsreport")
            }
        }
    });

    grunt.loadNpmTasks('grunt-exec');
    grunt.loadNpmTasks('grunt-mocha-test');

    grunt.registerTask('prepublish', ['exec:installJsReport', 'exec:buildDev', 'exec:buildProd']);

    grunt.registerTask('deploy-test', ['exec:buildDev', 'exec:buildProd', 'copy:deployTest']);
    grunt.registerTask('deploy-prod', ['exec:buildDev', 'exec:buildProd', 'copy:deployProd']);

    grunt.registerTask('test', ['mochaTest:test']);
};