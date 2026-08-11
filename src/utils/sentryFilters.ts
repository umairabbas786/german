import type * as Sentry from '@sentry/react';

function browserName(event: Sentry.Event): string {
  const browserContext = event.contexts?.browser as { name?: string; browser?: string } | undefined;
  return `${browserContext?.name || ''} ${browserContext?.browser || ''}`.trim();
}

function isInAppBrowserBridge(event: Sentry.Event): boolean {
  const name = browserName(event);
  return name.startsWith('Facebook') || name.startsWith('Instagram');
}

export function isInjectedWebkitBridgeError(event: Sentry.Event): boolean {
  const exception = event.exception?.values?.[0];
  const exceptionValue = exception?.value || '';
  const hasFacebookBridgeBreadcrumb = event.breadcrumbs?.some((breadcrumb) =>
    breadcrumb.message?.includes('hxp-chat-suppression')
  );

  // FB/Instagram IAB injects WKWebView bridge helpers that assume
  // window.webkit.messageHandlers exists; it often doesn't.
  return Boolean(
    exception?.type === 'TypeError' &&
    exceptionValue.includes('window.webkit.messageHandlers') &&
    (exceptionValue.includes('postMessage') ||
      hasFacebookBridgeBreadcrumb ||
      isInAppBrowserBridge(event))
  );
}

export function isInjectedAndroidNavigationBridgeError(event: Sentry.Event): boolean {
  const exception = event.exception?.values?.[0];
  const frames = exception?.stacktrace?.frames || [];
  const hasInjectedAndroidBridgeFrame = frames.some((frame) =>
    frame.filename?.startsWith('iabjs://') ||
    frame.abs_path?.startsWith('iabjs://')
  );
  const isKnownJavaBridgeFailure =
    exception?.value === 'Error invoking postMessage: Java object is gone' ||
    exception?.value === 'Error invoking postMessage: Java exception was raised during method invocation' ||
    exception?.value === 'Error invoking postMessage: Java bridge method invocation error' ||
    exception?.value === 'Error invoking enableDidUserTypeOnKeyboardLogging: Java object is gone';

  return Boolean(
    isInAppBrowserBridge(event) &&
    exception?.type === 'Error' &&
    isKnownJavaBridgeFailure &&
    hasInjectedAndroidBridgeFrame
  );
}

export function isFacebookDocumentSyntaxError(event: Sentry.Event): boolean {
  const exception = event.exception?.values?.[0];
  const exceptionValue = exception?.value || '';
  const name = browserName(event);
  const isFacebookBrowser = name.startsWith('Facebook');
  const frames = exception?.stacktrace?.frames || [];
  const documentFrame = frames.find((frame) => frame.filename === window.location.origin + '/');

  return Boolean(
    isFacebookBrowser &&
    exception?.type === 'SyntaxError' &&
    exceptionValue === 'Unexpected end of input' &&
    documentFrame?.abs_path?.includes('fbclid=')
  );
}

export function isBrowserStorageDeniedError(event: Sentry.Event): boolean {
  const exception = event.exception?.values?.[0];
  const exceptionValue = exception?.value || '';

  return Boolean(
    exception?.type === 'SecurityError' &&
    (exceptionValue === 'The request was denied.' ||
      exceptionValue.includes("Failed to read the 'localStorage' property")) &&
    !exception?.stacktrace?.frames?.length
  );
}

export function isZaloInjectedBridgeError(event: Sentry.Event): boolean {
  const exception = event.exception?.values?.[0];
  const frames = exception?.stacktrace?.frames || [];

  return Boolean(
    exception?.type === 'ReferenceError' &&
    exception.value === "Can't find variable: zaloJSV2" &&
    frames.some((frame) => frame.function === 'global code')
  );
}

export function isSnapchatInjectedBridgeError(event: Sentry.Event): boolean {
  const exception = event.exception?.values?.[0];
  const frames = exception?.stacktrace?.frames || [];

  return Boolean(
    exception?.type === 'ReferenceError' &&
    exception.value === "Can't find variable: SCDynimacBridge" &&
    frames.some((frame) => frame.function === 'global code')
  );
}

export function shouldDropSentryEvent(event: Sentry.Event): boolean {
  return isInjectedWebkitBridgeError(event) ||
    isInjectedAndroidNavigationBridgeError(event) ||
    isFacebookDocumentSyntaxError(event) ||
    isBrowserStorageDeniedError(event) ||
    isZaloInjectedBridgeError(event) ||
    isSnapchatInjectedBridgeError(event);
}
