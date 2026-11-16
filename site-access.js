(function () {
    const pageAccess = window.NEX_UP_PAGE_ACCESS;
    const currentPath = window.location.pathname.replace(/\/+$/, "");
    const isServicesPage = /\/servicios(?:\/index\.html|\/frp-xiaomi\.html)?$/.test(currentPath);
    const isRentalPage = /\/renta-tools(?:\/index\.html)?$/.test(currentPath);
    const currentPage = isServicesPage ? "services" : isRentalPage ? "rentalTools" : null;

    if (currentPage && pageAccess[currentPage] === false) {
        window.location.replace(new URL("../", window.location.href).href);
        return;
    }

    document.addEventListener("DOMContentLoaded", function () {
        document.querySelectorAll("[data-page-link]").forEach(function (element) {
            if (pageAccess[element.dataset.pageLink] !== false) {
                return;
            }

            const card = element.closest(".feature-card");
            const navItem = element.closest("li");
            const itemToHide = card || navItem || element;
            itemToHide.remove();
        });
    });
})();
