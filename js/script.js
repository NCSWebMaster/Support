(function () {
  "use strict";

  var CHECKOUT_ENDPOINT = "https://eqgzfrzokhowpedderrb.supabase.co/functions/v1/create-donation-checkout";
  var MIN_DOLLARS = 1;
  var MAX_DOLLARS = 10000;

  function setButtonsBusy(busy) {
    var buttons = document.querySelectorAll(".tier-cta, .closing-cta-btn, .modal-submit");
    buttons.forEach(function (btn) {
      btn.disabled = busy;
    });
  }

  function startCheckout(amountCents, triggerBtn) {
    var originalText = triggerBtn ? triggerBtn.textContent : null;
    setButtonsBusy(true);
    if (triggerBtn) triggerBtn.textContent = "Redirecting…";

    fetch(CHECKOUT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_cents: amountCents,
        recurring: true,
        site: "support",
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
        if (triggerBtn && originalText) triggerBtn.textContent = originalText;
        window.alert(
          "Something went wrong starting your gift. Please try again, or email office@northridgecommunityschool.com and we'll help you directly."
        );
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
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

    // Custom monthly amount modal
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
