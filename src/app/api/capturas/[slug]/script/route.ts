import { NextRequest, NextResponse } from "next/server";
import { getPublishedCapturePopup, withPublicCors } from "@/lib/capture-popups/server";

function escapeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const bundle = await getPublishedCapturePopup(slug);

  if (!bundle) {
    return withPublicCors(new NextResponse("console.warn('FlowLux popup nao encontrado');", {
      status: 404,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    }));
  }

  const origin = new URL(req.url).origin;
  const popup = {
    id: bundle.popup.id,
    slug: bundle.popup.slug,
    content: bundle.popup.content,
    theme: bundle.popup.theme,
    trigger: bundle.popup.trigger,
    integrations: {
      success_mode: bundle.popup.integrations?.success_mode,
      redirect_url: bundle.popup.integrations?.redirect_url,
      whatsapp_phone: bundle.popup.integrations?.whatsapp_phone,
      whatsapp_message: bundle.popup.integrations?.whatsapp_message,
      pixel_enabled: bundle.popup.integrations?.pixel_enabled,
      pixel_id: bundle.popup.integrations?.pixel_id,
    },
  };
  const fields = bundle.fields.map((field) => ({
    field_key: field.field_key,
    type: field.type,
    label: field.label,
    placeholder: field.placeholder,
    is_required: field.is_required,
    width: field.width,
  }));

  const script = `
(function () {
  var popup = ${escapeJson(popup)};
  var fields = ${escapeJson(fields)};
  var baseUrl = ${escapeJson(origin)};
  var submitUrl = baseUrl + "/api/capturas/" + popup.slug;
  var trackUrl = baseUrl + "/api/capturas/" + popup.slug + "/track";
  var sessionKey = "flowlux-popup:" + popup.slug + ":session";
  var frequencyKey = "flowlux-popup:" + popup.slug + ":last-open";
  var overlayId = "flowlux-popup-overlay-" + popup.slug;
  var modalId = "flowlux-popup-modal-" + popup.slug;
  var styleId = "flowlux-popup-style-" + popup.slug;
  var widthMap = { xs: 320, sm: 380, md: 460, lg: 560, xl: 720 };
  var paddingMap = { xs: 16, sm: 20, md: 24, lg: 32, xl: 40 };
  var radiusMap = { md: "16px", lg: "24px", xl: "32px" };
  var rowImageMap = { sm: "32%", md: "40%", lg: "45%", half: "50%" };
  var columnImageMap = { sm: "120px", md: "180px", lg: "240px", half: "300px" };

  function generateToken() {
    return "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function getSessionToken() {
    try {
      var existing = sessionStorage.getItem(sessionKey);
      if (existing) return existing;
      var created = generateToken();
      sessionStorage.setItem(sessionKey, created);
      return created;
    } catch (error) {
      return generateToken();
    }
  }

  function canAutoOpen() {
    try {
      if (popup.trigger.frequency === "always") return true;
      if (popup.trigger.frequency === "once_per_session") {
        return !sessionStorage.getItem(frequencyKey);
      }
      if (popup.trigger.frequency === "once_per_day") {
        var previous = Number(localStorage.getItem(frequencyKey) || "0");
        return !previous || (Date.now() - previous) > 86400000;
      }
    } catch (error) {
      return true;
    }
    return true;
  }

  function markOpened() {
    try {
      if (popup.trigger.frequency === "once_per_session") {
        sessionStorage.setItem(frequencyKey, String(Date.now()));
        return;
      }
      if (popup.trigger.frequency === "once_per_day") {
        localStorage.setItem(frequencyKey, String(Date.now()));
      }
    } catch (error) {}
  }

  function track(eventType, detail) {
    var payload = {
      event_type: eventType,
      session_token: getSessionToken(),
      source_url: window.location.href,
      referrer: document.referrer || "",
      detail: detail || null
    };

    fetch(trackUrl, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(function () {});
  }

  function initPixel() {
    if (!popup.integrations.pixel_enabled || !popup.integrations.pixel_id) return;
    if (window.fbq) return;
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", popup.integrations.pixel_id);
    window.fbq("track", "PageView");
  }

  function trackPixel(eventName, payload) {
    if (typeof window.fbq === "function") {
      window.fbq("trackCustom", eventName, payload || {});
    }
  }

  function readUtmParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      fbclid: params.get("fbclid"),
      gclid: params.get("gclid")
    };
  }

  function sanitizePhoneInputValue(value) {
    var trimmed = String(value || "").trim();
    var hasPlus = trimmed.indexOf("+") === 0;
    var digits = trimmed.replace(/\\D/g, "");
    return {
      digits: digits,
      hasPlus: hasPlus
    };
  }

  function looksLikeBrazilNumber(digits) {
    if (!digits) return false;
    if (digits.indexOf("55") === 0 && (digits.length === 12 || digits.length === 13)) return true;
    if (digits.length === 10 || digits.length === 11) {
      var ddd = Number(digits.slice(0, 2));
      return ddd >= 11 && ddd <= 99;
    }
    return false;
  }

  function formatBrazilPhone(digits) {
    var localDigits = digits.indexOf("55") === 0 ? digits.slice(2) : digits;
    localDigits = localDigits.slice(0, 11);
    if (!localDigits) return "";
    if (localDigits.length <= 2) return "(" + localDigits;
    if (localDigits.length <= 6) return "(" + localDigits.slice(0, 2) + ") " + localDigits.slice(2);
    if (localDigits.length <= 10) {
      return "(" + localDigits.slice(0, 2) + ") " + localDigits.slice(2, 6) + "-" + localDigits.slice(6);
    }
    return "(" + localDigits.slice(0, 2) + ") " + localDigits.slice(2, 7) + "-" + localDigits.slice(7, 11);
  }

  function formatInternationalPhone(digits) {
    if (!digits) return "";
    var normalized = digits.slice(0, 15);
    if (normalized.length <= 2) return "+" + normalized;

    var parts = [];
    var cursor = 0;
    var countryLength = normalized.length > 11 ? 2 : 1;
    parts.push("+" + normalized.slice(0, countryLength));
    cursor = countryLength;

    while (cursor < normalized.length) {
      var remaining = normalized.length - cursor;
      var chunkSize = remaining > 8 ? 3 : remaining > 4 ? 3 : 2;
      parts.push(normalized.slice(cursor, cursor + chunkSize));
      cursor += chunkSize;
    }

    return parts.join(" ");
  }

  function formatPhoneForDisplay(value) {
    var parsed = sanitizePhoneInputValue(value);
    if (!parsed.digits) return "";

    if (!parsed.hasPlus && looksLikeBrazilNumber(parsed.digits)) {
      return formatBrazilPhone(parsed.digits);
    }

    if (parsed.hasPlus || parsed.digits.length > 11) {
      if (parsed.digits.indexOf("55") === 0 && (parsed.digits.length === 12 || parsed.digits.length === 13)) {
        return "+55 " + formatBrazilPhone(parsed.digits).replace(/^\\(/, "(");
      }
      return formatInternationalPhone(parsed.digits);
    }

    return formatBrazilPhone(parsed.digits);
  }

  function attachPhoneMask(input) {
    if (!input) return;

    var applyMask = function () {
      input.value = formatPhoneForDisplay(input.value);
    };

    input.addEventListener("input", applyMask);
    input.addEventListener("blur", applyMask);
  }

  function ensureStyle() {
    if (document.getElementById(styleId)) return;
    var style = document.createElement("style");
    style.id = styleId;
    style.textContent = ""
      + ".flowlux-popup-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:20px;z-index:999999;}"
      + ".flowlux-popup-modal{box-sizing:border-box;position:relative;width:min(100%, " + (widthMap[popup.theme.panel_width] || 460) + "px);overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.35);}"
      + ".flowlux-popup-close{position:absolute;top:12px;right:14px;border:none;background:transparent;color:inherit;font-size:22px;cursor:pointer;line-height:1;}"
      + ".flowlux-popup-inner{box-sizing:border-box;}"
      + ".flowlux-popup-shell{display:flex;overflow:hidden;}"
      + ".flowlux-popup-media{overflow:hidden;}"
      + ".flowlux-popup-media img{display:block;width:100%;height:100%;object-fit:cover;}"
      + ".flowlux-popup-title{margin:0 0 10px;font-size:30px;line-height:1.1;font-weight:800;}"
      + ".flowlux-popup-description{margin:0 0 18px;font-size:14px;line-height:1.5;opacity:.82;}"
      + ".flowlux-popup-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}"
      + ".flowlux-popup-field{display:flex;flex-direction:column;gap:6px;grid-column:span 2;}"
      + ".flowlux-popup-field.half{grid-column:span 1;}"
      + ".flowlux-popup-label{font-size:12px;font-weight:700;}"
      + ".flowlux-popup-input,.flowlux-popup-textarea{width:100%;box-sizing:border-box;padding:14px 16px;border:1px solid " + popup.theme.field_border_color + ";background:" + popup.theme.field_background + ";color:" + popup.theme.field_text_color + ";border-radius:999px;font-size:14px;outline:none;}"
      + ".flowlux-popup-textarea{border-radius:20px;min-height:120px;resize:vertical;}"
      + ".flowlux-popup-submit{width:100%;margin-top:16px;border:none;border-radius:999px;padding:14px 18px;background:" + popup.theme.button_color + ";color:" + popup.theme.button_text_color + ";font-size:15px;font-weight:800;cursor:pointer;}"
      + ".flowlux-popup-error{margin-top:10px;font-size:12px;color:#ffb4b4;min-height:16px;}"
      + ".flowlux-popup-note{margin-top:12px;font-size:11px;line-height:1.5;opacity:.72;text-align:center;}"
      + ".flowlux-popup-success{display:none;text-align:center;}"
      + ".flowlux-popup-success h3{margin:0 0 8px;font-size:24px;font-weight:800;}"
      + ".flowlux-popup-success p{margin:0;font-size:14px;line-height:1.5;opacity:.84;}"
      + "@media (max-width: 640px){.flowlux-popup-grid{grid-template-columns:1fr;}.flowlux-popup-field.half{grid-column:span 1;}.flowlux-popup-title{font-size:24px;}}";
    document.head.appendChild(style);
  }

  function getPanelBackgroundStyle() {
    if (popup.theme.background_mode === "image" && popup.theme.background_image_url) {
      return "background:" + popup.theme.background_color + " url('" + popup.theme.background_image_url + "') center/" + "cover no-repeat;";
    }
    return "background:" + popup.theme.panel_background + ";";
  }

  function render() {
    if (document.getElementById(overlayId)) return;
    ensureStyle();

    var overlay = document.createElement("div");
    overlay.id = overlayId;
    overlay.className = "flowlux-popup-overlay";
    overlay.style.background = popup.theme.overlay_color;
    overlay.style.opacity = String(popup.theme.overlay_opacity / 100);

    var modal = document.createElement("div");
    modal.id = modalId;
    modal.className = "flowlux-popup-modal";
    modal.style.borderRadius = radiusMap[popup.theme.border_radius] || "24px";
    modal.style.color = popup.theme.panel_text_color;
    modal.style.fontFamily = popup.theme.font_family;
    modal.style.background = popup.theme.panel_background;
    modal.style.backgroundImage = popup.theme.background_mode === "image" && popup.theme.background_image_url
      ? "linear-gradient(rgba(0,0,0,.10), rgba(0,0,0,.10)), url('" + popup.theme.background_image_url + "')"
      : "";
    modal.style.backgroundSize = popup.theme.background_mode === "image" ? "cover" : "";
    modal.style.backgroundPosition = popup.theme.background_mode === "image"
      ? popup.theme.background_image_focus_x + "% " + popup.theme.background_image_focus_y + "%"
      : "";

    if (popup.trigger.show_close_button) {
      var close = document.createElement("button");
      close.type = "button";
      close.className = "flowlux-popup-close";
      close.innerHTML = "&times;";
      close.addEventListener("click", closePopup);
      modal.appendChild(close);
    }

    var hasMainImage = !!popup.theme.top_image_url;
    var shell = document.createElement("div");
    shell.className = "flowlux-popup-shell";
    var layoutMode = popup.theme.layout_mode || "column";
    var imagePosition = popup.theme.image_position || "top";

    var shouldStackOnMobile = typeof window !== "undefined" && window.innerWidth <= 640;

    if (hasMainImage && layoutMode === "row" && !shouldStackOnMobile) {
      shell.style.flexDirection = imagePosition === "right" ? "row-reverse" : "row";
      shell.style.minHeight = "520px";
    } else {
      shell.style.flexDirection = imagePosition === "bottom" ? "column-reverse" : "column";
    }

    var media = null;
    if (hasMainImage) {
      media = document.createElement("div");
      media.className = "flowlux-popup-media";
      if (layoutMode === "row" && !shouldStackOnMobile) {
        media.style.flex = "0 0 " + (rowImageMap[popup.theme.image_size || "md"] || "40%");
      } else {
        media.style.height = columnImageMap[popup.theme.image_size || "md"] || "180px";
      }

      var image = document.createElement("img");
      image.src = popup.theme.top_image_url;
      image.alt = "";
      media.appendChild(image);
    }

    var inner = document.createElement("div");
    inner.className = "flowlux-popup-inner";
    inner.style.padding = (paddingMap[popup.theme.panel_padding || "md"] || 24) + "px";

    var title = document.createElement("h2");
    title.className = "flowlux-popup-title";
    title.style.fontFamily = popup.theme.title_font_family;
    title.textContent = popup.content.title || "";
    inner.appendChild(title);

    if (popup.content.description) {
      var description = document.createElement("p");
      description.className = "flowlux-popup-description";
      description.textContent = popup.content.description;
      inner.appendChild(description);
    }

    var formEl = document.createElement("form");
    formEl.className = "flowlux-popup-form";

    var grid = document.createElement("div");
    grid.className = "flowlux-popup-grid";

    fields.forEach(function (field) {
      var wrapper = document.createElement("label");
      wrapper.className = "flowlux-popup-field" + (field.width === "half" ? " half" : "");
      var label = document.createElement("span");
      label.className = "flowlux-popup-label";
      label.textContent = field.label + (field.is_required ? " *" : "");
      wrapper.appendChild(label);

      var input = field.type === "textarea" ? document.createElement("textarea") : document.createElement("input");
      input.name = field.field_key;
      input.placeholder = field.placeholder || "";
      if (field.type !== "textarea") {
        input.type = field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text";
        input.className = "flowlux-popup-input";
        if (field.type === "phone") {
          input.inputMode = "tel";
          input.autocomplete = "tel";
          attachPhoneMask(input);
        }
      } else {
        input.className = "flowlux-popup-textarea";
      }
      input.required = !!field.is_required;
      wrapper.appendChild(input);
      grid.appendChild(wrapper);
    });

    formEl.appendChild(grid);

    var error = document.createElement("div");
    error.className = "flowlux-popup-error";
    formEl.appendChild(error);

    var submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "flowlux-popup-submit";
    submit.textContent = popup.content.button_text || "Enviar";
    formEl.appendChild(submit);

    if (popup.content.disclaimer) {
      var disclaimer = document.createElement("div");
      disclaimer.className = "flowlux-popup-note";
      disclaimer.textContent = popup.content.disclaimer;
      formEl.appendChild(disclaimer);
    }

    var success = document.createElement("div");
    success.className = "flowlux-popup-success";
    success.innerHTML = "<h3>" + (popup.content.success_title || "Tudo certo") + "</h3><p>" + (popup.content.success_description || "Recebemos seus dados.") + "</p>";

    formEl.addEventListener("submit", function (event) {
      event.preventDefault();
      submit.disabled = true;
      error.textContent = "";

      var answers = {};
      fields.forEach(function (field) {
        var input = formEl.elements.namedItem(field.field_key);
        answers[field.field_key] = input ? String(input.value || "").trim() : "";
      });

      var payload = Object.assign({
        answers: answers,
        session_token: getSessionToken(),
        source_url: window.location.href,
        referrer: document.referrer || ""
      }, readUtmParams());

      fetch(submitUrl, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (response) { return response.json().then(function (data) { return { ok: response.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok) {
            throw new Error(result.data && result.data.error ? result.data.error : "Nao foi possivel enviar");
          }

          trackPixel("FlowLuxPopupSubmit", { slug: popup.slug });
          if (result.data.redirect_url) {
            track("redirect", result.data.redirect_url);
            window.location.href = result.data.redirect_url;
            return;
          }

          formEl.style.display = "none";
          success.style.display = "block";
        })
        .catch(function (submitError) {
          error.textContent = submitError && submitError.message ? submitError.message : "Nao foi possivel enviar.";
        })
        .finally(function () {
          submit.disabled = false;
        });
    });

    inner.appendChild(formEl);
    inner.appendChild(success);
    if (media) shell.appendChild(media);
    shell.appendChild(inner);
    modal.appendChild(shell);
    overlay.appendChild(modal);

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) {
        closePopup();
      }
    });

    document.body.appendChild(overlay);
    track("view", "script_loaded");
  }

  function openPopup() {
    render();
    if (!canAutoOpen() && popup.trigger.mode !== "manual") return;
    var overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.style.display = "flex";
    markOpened();
    track("open", popup.trigger.mode);
    trackPixel("FlowLuxPopupOpen", { slug: popup.slug });
  }

  function closePopup() {
    var overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.style.display = "none";
    track("close", "user_closed");
  }

  function scheduleAutoOpen() {
    if (popup.trigger.mode === "manual") return;
    if (popup.trigger.mode === "click" && popup.trigger.click_selector) {
      document.querySelectorAll(popup.trigger.click_selector).forEach(function (element) {
        element.addEventListener("click", function (event) {
          event.preventDefault();
          openPopup();
        });
      });
      return;
    }

    if (popup.trigger.mode === "on_load") {
      openPopup();
      return;
    }

    var delaySeconds = Number(popup.trigger.delay_seconds || 0);
    window.setTimeout(openPopup, Math.max(0, delaySeconds) * 1000);
  }

  initPixel();
  render();
  window.FlowLuxPopups = window.FlowLuxPopups || {};
  window.FlowLuxPopups[popup.slug] = { open: openPopup, close: closePopup };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleAutoOpen);
  } else {
    scheduleAutoOpen();
  }
})();
`;

  return withPublicCors(new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  }));
}
