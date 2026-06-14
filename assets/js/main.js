// Utility Functions
const $body = document.querySelector('body');

function scrollToElement(e, style, duration) {
    let target = e;
    if (typeof e === 'string')
        target = document.querySelector(e);
    
    if (!target)
        return;

    const start = window.scrollY || window.pageYOffset;
    const targetY = window.innerHeight/2 - target.getBoundingClientRect().top;
    const startTime = performance.now();
    const easing = style === 'smooth' ? t => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1) : t => t;

    const scroll = () => {
        const currentTime = performance.now() - startTime;
        const time = Math.min(1, currentTime / duration);
        const easedTime = easing(time);
        
        window.scroll(0, Math.lerp(start, targetY, easedTime));

        if (time < 1)
            requestAnimationFrame(scroll);
    };

    requestAnimationFrame(scroll);
}

function thisURL() {
    return window.location.href.replace(/#$/, '').replace(/\/$/, '');
}

function getVar(name) {
    let value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (value && value.charAt(0) === "'")
        value = value.substring(1, value.length - 1);
    return value;
}

// Error Handling
const errors = {
    handle: function(handler) {
        window.onerror = function(message) {
            (handler)(message);
            return true;
        };
    },
    unhandle: function() {
        window.onerror = null;
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Wait for fonts to load
    document.fonts.ready.then(() => {
        // Remove loading class immediately to prevent any interference
        document.body.classList.remove('is-loading');
        
        // Add animation class after a brief delay
        requestAnimationFrame(() => {
            document.body.classList.add('animate-in');
        });
    });

    // Scroll events
    let scrollEvents = {
        items: [],
        add: function(o) {
            this.items.push({
                element: o.element,
                enter: ('enter' in o ? o.enter : null),
                leave: ('leave' in o ? o.leave : null),
                mode: ('mode' in o ? o.mode : 3),
                offset: ('offset' in o ? o.offset : 0),
                state: false,
            });
        },
        handler: function() {
            let height = window.innerHeight,
                top = window.scrollY,
                bottom = top + height;

            scrollEvents.items.forEach(item => {
                let bcr = item.element.getBoundingClientRect(),
                    elementTop = top + Math.floor(bcr.top),
                    elementBottom = elementTop + Math.floor(bcr.height),
                    state = (item.mode == 1 ? elementTop >= top && elementTop <= bottom
                            : item.mode == 2 ? elementBottom >= top && elementBottom <= bottom
                            : elementTop < bottom && elementBottom > top);

                if (state != item.state) {
                    item.state = state;
                    
                    if (item.state) {
                        if (item.enter) {
                            (item.enter).apply(item.element);
                            if (!item.leave)
                                scrollEvents.items.splice(scrollEvents.items.indexOf(item), 1);
                        }
                    } else if (item.leave) {
                        (item.leave).apply(item.element);
                        if (!item.enter)
                            scrollEvents.items.splice(scrollEvents.items.indexOf(item), 1);
                    }
                }
            });
        }
    };

    on('load', scrollEvents.handler);
    on('resize', scrollEvents.handler);
    on('scroll', scrollEvents.handler);

    // Touch events
    (function() {
        let isTouch = false;
        
        const onTouch = () => {
            if (isTouch) return;
            
            isTouch = true;
            $body.classList.add('is-touch');
            
            window.removeEventListener('touchstart', onTouch);
        };

        on('load', () => window.addEventListener('touchstart', onTouch));
        on('orientationchange', onTouch);
        on('touchmove', onTouch);
    })();

    // Animate container and cards
    const container = document.querySelector('.container');
    const cards = document.querySelectorAll('.link-card');
    
    setTimeout(() => {
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
        
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 100 * (index + 1));
        });
    }, 100);

    // Handle card clicks
    cards.forEach(card => {
        if (card.classList.contains('projects-card')) {
            card.addEventListener('click', () => {
                requestAnimationFrame(() => {
                    document.querySelector('.container').classList.add('show-projects');
                });
            });
        } else if (!card.querySelector('.link-title').textContent.includes('Resume')) {
            card.addEventListener('click', (e) => {
                // If clicking an action icon, don't trigger the card click
                if (e.target.closest('.action-icon')) {
                    e.stopPropagation();
                    return;
                }
                
                const href = card.getAttribute('href');
                if (href) {
                    window.location.href = href;
                }
            });
        }
    });

    // Handle back button
    const backButton = document.querySelector('.back-button');
    if (backButton) {
        backButton.addEventListener('click', () => {
            document.querySelector('.container').classList.remove('show-projects');
        });
    }
});

// Event listener utility
function on(event, fn) {
    window.addEventListener(event, fn);
}
