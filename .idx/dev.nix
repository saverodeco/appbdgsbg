
# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"
  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20
    # Add Supabase CLI for interacting with your Supabase project
    pkgs.supabase-cli
  ];
  # Sets environment variables in the workspace
  env = {
    # Using secrets for Supabase credentials
    NEXT_PUBLIC_SUPABASE_URL = "https://vlsbavtjdukpekpistbd.supabase.co";
    NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsc2JhdnRqZHVrcGVrcGlzdGJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NzQ3MDYsImV4cCI6MjA3ODE1MDcwNn0.QkOs5rFdXafsZEMakTIjeALSiVAUnDK1gLqcvxmuQHU"; 
  };
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      "dbaeumer.vscode-eslint"
    ];
    # Enable previews
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT"];
          manager = "web";
        };
      };
    };
    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        npm-install = "npm install";
      };
      # Runs when the workspace is (re)started
      onStart = {
        dev-server = "npm run dev";
      };
    };
  };
}
