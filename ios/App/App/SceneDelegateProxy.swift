import UIKit

// Fallback proxy to satisfy Capacitor scene delegation if required
class SceneDelegateProxy {
    static let shared = SceneDelegateProxy()
    
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {}
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {}
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {}
}
