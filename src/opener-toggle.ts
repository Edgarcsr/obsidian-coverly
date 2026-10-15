/**
 * Os quadros fecham no `pointerdown` fora deles, e o botão que os abriu conta
 * como "fora". Sem isso, o `click` que vem logo depois abriria o quadro de
 * novo. Quando o toque é no próprio botão, esse próximo clique é engolido,
 * então clicar de novo no botão fecha o quadro em vez de reabri-lo.
 */
export const swallowOpenerClick = (
  opener: HTMLElement | null | undefined,
  target: EventTarget | null
): void => {
  if (!(opener && target instanceof Node && opener.contains(target))) {
    return;
  }
  window.addEventListener(
    "click",
    (event) => {
      if (event.target instanceof Node && opener.contains(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    { capture: true, once: true }
  );
};
