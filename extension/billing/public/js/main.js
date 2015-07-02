define(["app", "marionette", "backbone", "jquery"],
    function (app, Marionette, Backbone, $) {
        app.module("billing", function (module) {

            app.on("after-template-render", function() {
                setTimeout(function() {
                    app.reloadSettings(function() {
                        updateCreditStatus();
                    });
                }, 5000)
            });

            function updateCreditStatus($el) {
                $el = $el || $("#creditStatus");

                var usedCredits = app.settings.tenant.creditsUsed - (app.settings.tenant.creditsBilled);
                var creditsString = usedCredits + " / " + (app.settings.tenant.creditsAvailable || "300000");
                $el.html(creditsString);

                $el.removeClass("btn-success").removeClass("btn-danger");

                if (usedCredits > app.settings.tenant.creditsAvailable)
                    $el.addClass("btn-danger");
                else
                    $el.addClass("btn-success");
            }

            app.on("user-info-render", function (context) {
                context.result += "<li><a id='creditStatus' class='btn-success'>Loading ...</a></li>";

                context.on("after-render", function($el) {
                    updateCreditStatus($el.find("#creditStatus"));
                    $el.find("#creditStatus").click(function() {
                        $.dialog({
                            header: "CREDITS STATUS",
                            content: $.render["billing-dialog"](app.settings.tenant),
                            hideSubmit: true
                        });
                    });
                });
            });
        });
    });