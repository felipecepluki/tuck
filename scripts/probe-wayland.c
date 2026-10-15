/* Inspect advertised capabilities only: never read clipboard content. */
#include <stdio.h>
#include <string.h>
#include <wayland-client.h>
static void global(void *data, struct wl_registry *registry, uint32_t name,
                   const char *interface, uint32_t version) {
  (void)data; (void)registry; (void)name;
  if (strstr(interface, "data_control") || strcmp(interface, "wl_data_device_manager") == 0)
    printf("%s v%u\n", interface, version);
}
static void removed(void *data, struct wl_registry *registry, uint32_t name) {
  (void)data; (void)registry; (void)name;
}
static const struct wl_registry_listener listener = {global, removed};
int main(void) {
  struct wl_display *display = wl_display_connect(NULL);
  if (!display) { fprintf(stderr, "Cannot connect to Wayland session\n"); return 1; }
  struct wl_registry *registry = wl_display_get_registry(display);
  wl_registry_add_listener(registry, &listener, NULL);
  int result = wl_display_roundtrip(display);
  wl_registry_destroy(registry);
  wl_display_disconnect(display);
  return result < 0;
}
