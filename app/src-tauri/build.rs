fn main() {
    let out_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("embedded");
    let blob = out_dir.join("runtime.7z");
    println!("cargo:rustc-check-cfg=cfg(embed_runtime)");
    if blob.exists() {
        println!("cargo:rustc-cfg=embed_runtime");
        println!("cargo:rerun-if-changed=embedded/runtime.7z");
    }
    tauri_build::build()
}