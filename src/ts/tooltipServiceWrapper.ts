module powerbi.extensibility.visual {

    export interface TooltipEventArgs<TData> {
        data: TData;
        coordinates: number[];
        isTouchEvent: boolean;
    }

    export interface ITooltipServiceWrapper {
        addTooltip<T>(
            map,
            layers,
            getTooltipInfoDelegate: (args: TooltipEventArgs<T>) => VisualTooltipDataItem[],
            reloadTooltipDataOnMouseMove?: boolean): void;
        hide(immediately?: boolean): void;
    }

    const DefaultHandleTouchDelay = 1000;

    export function createTooltipServiceWrapper(tooltipService: ITooltipService, rootElement: HTMLElement, handleTouchDelay: number = DefaultHandleTouchDelay): ITooltipServiceWrapper {
        return new TooltipServiceWrapper(tooltipService, rootElement, handleTouchDelay);
    }

    class TooltipServiceWrapper implements ITooltipServiceWrapper {
        private handleTouchTimeoutId: number;
        private visualHostTooltipService: ITooltipService;
        private rootElement: HTMLElement;
        private handleTouchDelay: number;

        constructor(tooltipService: ITooltipService, rootElement: HTMLElement, handleTouchDelay: number) {
            this.visualHostTooltipService = tooltipService;
            this.handleTouchDelay = handleTouchDelay;
            this.rootElement = rootElement;
        }

        public debounce = function(func, wait, immediate) {
            let timeout;
            return function() {
                let context = this, args = arguments;
                let later = function() {
                    timeout = null;
                    if (!immediate) func.apply(context, args);
                };
                let callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) func.apply(context, args);
            };
        };

        public addTooltip<T>(
            map,
            layers,
            getTooltipInfoDelegate: (args: TooltipEventArgs<T>) => VisualTooltipDataItem[],
            reloadTooltipDataOnMouseMove?: boolean): void {

                if (!map || !this.visualHostTooltipService.enabled()) {
                    return;
                }

                let rootNode = this.rootElement;

                // Multiple following assignments are because browsers only
                // pick up assigments if they understand the assigned value
                // and ignore all other case.
                rootNode.style.cursor = '-webkit-grab';
                rootNode.style.cursor = 'grab';

                const hideTooltip = (e) => {
                    this.hide()
                };

                const showTooltip = this.debounce((e) => {
                    rootNode.style.cursor = 'pointer';
                    let tooltipEventArgs = this.makeTooltipEventArgs<T>(e);
                    if (!tooltipEventArgs)
                        return;

                    let tooltipInfo: VisualTooltipDataItem[];
                    if (reloadTooltipDataOnMouseMove || true) {
                        tooltipInfo = getTooltipInfoDelegate(tooltipEventArgs);
                        if (tooltipInfo == null)
                            return;
                    }

                    this.visualHostTooltipService.show({
                        coordinates: tooltipEventArgs.coordinates,
                        isTouchEvent: false,
                        dataItems: tooltipInfo,
                        identities: [],
                    });
                }, 12, true)

                layers.map( layerId => {
                    map.off('mouseleave', layerId, hideTooltip);
                    map.on('mouseleave', layerId, hideTooltip);

                    map.off('mousemove', layerId, showTooltip);
                    map.on('mousemove', layerId, showTooltip);
                });
        }

        private getDisplayNameMap(metadata) {
            let ret = {}
            metadata.columns.map(column => {
                Object.keys(column.roles).map(role => {
                    ret[role] = column.displayName
                });
            });
            return ret;
        }

        public hide(immediately = false): void {
            const rootNode = this.rootElement;

            rootNode.style.cursor = '-webkit-grab';
            rootNode.style.cursor = 'grab';
            this.visualHostTooltipService.hide({
                isTouchEvent: false,
                immediately
            });
        }

        private makeTooltipEventArgs<T>(e: any): TooltipEventArgs<T> {

            let tooltipEventArgs : TooltipEventArgs<T> = null;
            try {
                if (e.features && e.features.length > 0) {
                    tooltipEventArgs = {
                        // Take only the first three element until we figure out how
                        // to add pager to powerbi native tooltips
                        data: e.features.slice(0, 3).map( feature => {
                            return Object.keys(feature.properties).map( prop => {
                                return {
                                    key: prop,
                                    value: feature.properties[prop]
                                }
                            });
                        }),
                        coordinates: [e.point.x, e.point.y],
                        isTouchEvent: false
                    };

                }
            } finally {
                return tooltipEventArgs;
            }
        }
    }
}
