(function () {
  "use strict";

  var SUPABASE_URL = "https://eqgzfrzokhowpedderrb.supabase.co";
  var SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxZ3pmcnpva2hvd3BlZGRlcnJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjU4ODIsImV4cCI6MjA5NzIwMTg4Mn0.r94X0ZGSdAO_vtd4dXQKmjdVFtPZ7wSpYeUVzPAkjJo";
  var CHECKOUT_ENDPOINT = SUPABASE_URL + "/functions/v1/create-donation-checkout";
  var MIN_DOLLARS = 1;
  var MAX_DOLLARS = 10000;
  var givingMode = "monthly";
  var FUND = document.body.getAttribute("data-fund") || "general";

  // Eases a number from 0 up to targetCents (rendered as a dollar figure)
  // over ~1.2s. Used by the campaign thermometer.
  function animateCountUp(el, targetCents) {
    if (!el) return;
    var targetDollars = targetCents / 100;
    var duration = 1200;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = "$" + Math.round(eased * targetDollars).toLocaleString("en-US");
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function setButtonsBusy(busy) {
    var buttons = document.querySelectorAll(".tier-cta, .closing-cta-btn, .modal-submit");
    buttons.forEach(function (btn) {
      btn.disabled = busy;
    });
  }

  function startCheckout(amountCents, triggerBtn) {
    var originalHTML = triggerBtn ? triggerBtn.innerHTML : null;
    setButtonsBusy(true);
    if (triggerBtn) triggerBtn.textContent = "Redirecting…";

    fetch(CHECKOUT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_cents: amountCents,
        recurring: givingMode === "monthly",
        site: "support",
        fund: FUND,
      }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.url) {
          window.location.href = data.url;
        } else {
          throw new Error("No checkout URL returned");
        }
      })
      .catch(function () {
        setButtonsBusy(false);
        if (triggerBtn && originalHTML) triggerBtn.innerHTML = originalHTML;
        window.alert(
          "Something went wrong starting your gift. Please try again, or email office@northridgecommunityschool.com and we'll help you directly."
        );
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Mobile nav toggle
    var menuToggle = document.getElementById("menuToggle");
    var navLinks = document.getElementById("navLinks");
    if (menuToggle && navLinks) {
      menuToggle.addEventListener("click", function () {
        var isOpen = navLinks.classList.toggle("open");
        menuToggle.classList.toggle("open");
        menuToggle.setAttribute("aria-expanded", isOpen);
      });
      navLinks.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          navLinks.classList.remove("open");
          menuToggle.classList.remove("open");
          menuToggle.setAttribute("aria-expanded", "false");
        });
      });
    }

    // Campaign thermometer — reads the live total from the public
    // campaign_progress view (aggregated, no donor data) and animates the
    // fill + counted-up dollar figure in.
    var thermometer = document.getElementById("campaignThermometer");
    if (thermometer) {
      var goalCents = parseInt(thermometer.getAttribute("data-goal-cents"), 10) || 0;
      var fillEl = document.getElementById("thermometerFill");
      var raisedEl = document.getElementById("thermometerRaised");

      fetch(
        SUPABASE_URL + "/rest/v1/campaign_progress?fund=eq." + encodeURIComponent(FUND) + "&select=raised_cents",
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY } }
      )
        .then(function (res) {
          return res.ok ? res.json() : [];
        })
        .then(function (rows) {
          var raisedCents = rows && rows[0] ? rows[0].raised_cents : 0;
          var pct = goalCents > 0 ? Math.min(100, (raisedCents / goalCents) * 100) : 0;
          requestAnimationFrame(function () {
            if (fillEl) fillEl.style.width = pct + "%";
          });
          animateCountUp(raisedEl, raisedCents);
        })
        .catch(function () {
          // Fail quietly — the thermometer just stays at $0 if this fetch fails.
        });
    }

    // Monthly / One-Time giving mode toggle. Monthly/one-time text pairs live
    // side by side in the markup (see .mode-swap in styles.css) and are
    // stacked in the same grid cell, so toggling which one is visible never
    // changes any element's height — nothing else on the page has to reflow.
    var togglePill = document.querySelector(".giving-toggle");
    var toggleButtons = document.querySelectorAll(".giving-toggle [data-mode]");

    function applyMode(mode) {
      if (mode === givingMode) return;
      givingMode = mode;
      document.body.classList.toggle("mode-onetime", mode === "onetime");
      if (togglePill) togglePill.classList.toggle("is-onetime", mode === "onetime");
      toggleButtons.forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-mode") === mode);
      });
    }

    toggleButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyMode(btn.getAttribute("data-mode"));
      });
    });

    // Tier buttons
    document.querySelectorAll(".tier-cta").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cents = parseInt(btn.getAttribute("data-amount-cents"), 10);
        if (!cents) return;
        startCheckout(cents, btn);
      });
    });

    // Closing CTA scrolls up to the tier ladder
    var closingBtn = document.getElementById("closingCtaBtn");
    if (closingBtn) {
      closingBtn.addEventListener("click", function () {
        var target = document.getElementById("tiers");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    // Custom amount modal
    var overlay = document.getElementById("customModalOverlay");
    var openLink = document.getElementById("customAmountLink");
    var closeBtn = document.getElementById("customModalClose");
    var form = document.getElementById("customAmountForm");
    var input = document.getElementById("customAmountInput");
    var errorEl = document.getElementById("customAmountError");

    function openModal(e) {
      if (e) e.preventDefault();
      if (!overlay) return;
      overlay.classList.add("open");
      errorEl.style.display = "none";
      input.value = "";
      setTimeout(function () {
        input.focus();
      }, 50);
    }

    function closeModal() {
      if (!overlay) return;
      overlay.classList.remove("open");
    }

    if (openLink) openLink.addEventListener("click", openModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (overlay) {
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeModal();
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay && overlay.classList.contains("open")) closeModal();
    });

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var dollars = parseFloat(input.value);

        if (!dollars || isNaN(dollars) || dollars < MIN_DOLLARS || dollars > MAX_DOLLARS) {
          errorEl.textContent = "Please enter an amount between $" + MIN_DOLLARS + " and $" + MAX_DOLLARS.toLocaleString() + ".";
          errorEl.style.display = "block";
          return;
        }

        errorEl.style.display = "none";
        var cents = Math.round(dollars * 100);
        var submitBtn = form.querySelector(".modal-submit");
        startCheckout(cents, submitBtn);
      });
    }
  });
})();
