module.exports = function(grunt) {
    
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        mochaTest: {
            test: {
                src: ['test/*.js']
            }
        },
        exec: {
            buildJsreport : {
                cmd: "grunt development",
                cwd: require("path").join("node_modules", "jsreport")
            }
        }
    });

    grunt.loadNpmTasks('grunt-exec');
    grunt.loadNpmTasks('grunt-mocha-test');

    grunt.registerTask('test', ['exec:buildJsreport', 'mochaTest:test']);
};