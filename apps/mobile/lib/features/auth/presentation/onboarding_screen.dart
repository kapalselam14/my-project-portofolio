import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/providers/auth_state_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/pressable_scale.dart';

// Page data.

class _OnboardingPage {
  const _OnboardingPage({
    required this.illustration,
    required this.heading,
    required this.description,
  });
  final String illustration;
  final String heading;
  final String description;
}

const _kPages = [
  _OnboardingPage(
    illustration: 'assets/images/onboarding/onb_1.png',
    heading: 'Discover Sports Activities Near You',
    description:
        'Find matches happening in your local neighborhood instantly. From friendly basketball runs to weekend tennis singles.',
  ),
  _OnboardingPage(
    illustration: 'assets/images/onboarding/onb_2.png',
    heading: 'Swipe to Match With Activities',
    description:
        'Find matches that perfectly fit your pace, schedule, and skill level. Simply swipe to browse sports groups.',
  ),
  _OnboardingPage(
    illustration: 'assets/images/onboarding/onb_3.png',
    heading: 'Join, Chat, and Play Together',
    description:
        'Coordination made simple. Live-chat with teammates, lock down the location, and let the games begin.',
  ),
];

// Screen.

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _pageController = PageController();
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
    );
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  /// '/get-to-know-1' is protected — logged-out users bounce back to /welcome.
  void _exitToAppFlow() {
    // Any Skip/Get Started tap counts as seen — persist best-effort.
    SharedPreferences.getInstance().then(
      (p) => p.setBool('hasSeenOnboarding', true),
    );
    final status = ref.read(authStatusProvider);
    context.go(
      status == AuthStatus.unauthenticated ? '/welcome' : '/get-to-know-1',
    );
  }

  void _next() {
    if (_currentPage < _kPages.length - 1) {
      _pageController.nextPage(
        duration: AppDurations.emphasized,
        curve: Curves.easeInOut,
      );
    } else {
      _exitToAppFlow();
    }
  }

  void _skip() => _exitToAppFlow();

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Full bleed paged images.
          PageView.builder(
            controller: _pageController,
            itemCount: _kPages.length,
            onPageChanged: (i) => setState(() => _currentPage = i),
            itemBuilder: (_, i) => _PageImage(page: _kPages[i]),
          ),

          // Top bar: MatchUp SKIP.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.x5,
                  vertical: AppSpacing.x3,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Logo badge image
                    Image.asset(
                      'assets/images/splash/logo-badge.png',
                      width: 36,
                      height: 36,
                      errorBuilder: (_, _, _) => const Icon(
                        Icons.sports_soccer_rounded,
                        size: 36,
                        color: Colors.white,
                      ),
                    ),
                    // SKIP badge
                    Semantics(
                      button: true,
                      label: 'Skip onboarding',
                      child: PressableScale(
                        onTap: _skip,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(AppRadius.pill),
                          ),
                          child: Text(
                            'SKIP',
                            style: AppTypography.chipLabel(context).copyWith(
                              color: AppColors.textOnPrimary,
                              fontSize: 12,
                              letterSpacing: 0.8,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Bottom overlay: dots heading desc button link.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.x5,
                AppSpacing.x6,
                AppSpacing.x5,
                bottomPad + AppSpacing.x4,
              ),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  stops: [0.0, 0.55, 1.0],
                  colors: [
                    Color(0xE6000000),
                    Color(0x99000000),
                    Colors.transparent,
                  ],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Dots — left-aligned
                  _Dots(current: _currentPage, total: _kPages.length),
                  const SizedBox(height: AppSpacing.x4),

                  // Heading — animated switch per page
                  AnimatedSwitcher(
                    duration: AppDurations.base,
                    transitionBuilder: (child, anim) =>
                        FadeTransition(opacity: anim, child: child),
                    child: _PageContent(
                      key: ValueKey(_currentPage),
                      heading: _kPages[_currentPage].heading,
                      description: _kPages[_currentPage].description,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.x5),

                  // Button — Next / Get Started
                  _NextButton(
                    label: _currentPage < _kPages.length - 1
                        ? 'Next'
                        : 'Get Started',
                    onTap: _next,
                  ),
                  const SizedBox(height: AppSpacing.x3),

                  // Sign in prompt
                  Center(
                    child: _SignInPrompt(onTap: () => context.go('/login')),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Page image with scrim.

class _PageImage extends StatelessWidget {
  const _PageImage({required this.page});
  final _OnboardingPage page;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.asset(
          page.illustration,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => const ColoredBox(color: Colors.black54),
        ),
        // Subtle overall dark tint so white text pops everywhere
        const ColoredBox(color: Color(0x55000000)),
      ],
    );
  }
}

// Dots.

class _Dots extends StatelessWidget {
  const _Dots({required this.current, required this.total});
  final int current;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.start,
      children: List.generate(total, (i) {
        final active = i == current;
        return Padding(
          padding: const EdgeInsets.only(right: AppSpacing.x2),
          child: AnimatedContainer(
            duration: AppDurations.base,
            curve: Curves.easeInOut,
            width: active ? 28 : 8,
            height: 8,
            decoration: BoxDecoration(
              color: active
                  ? AppColors
                        .primary // Blue active dot
                  : Colors.white.withValues(alpha: 0.40),
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
          ),
        );
      }),
    );
  }
}

// Page content.

class _PageContent extends StatelessWidget {
  const _PageContent({
    super.key,
    required this.heading,
    required this.description,
  });
  final String heading;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          heading,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 30,
            fontWeight: FontWeight.w800,
            height: 1.2,
            letterSpacing: -0.3,
          ),
        ),
        const SizedBox(height: AppSpacing.x3),
        Text(
          description,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.75),
            fontSize: 14.5,
            fontWeight: FontWeight.w400,
            height: 1.55,
          ),
        ),
      ],
    );
  }
}

// Next Get Started button.

class _NextButton extends StatelessWidget {
  const _NextButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: PressableScale(
        onTap: onTap,
        child: Container(
          width: double.infinity,
          height: 54,
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.1,
                ),
              ),
              const SizedBox(width: AppSpacing.x2),
              const Icon(
                Icons.arrow_forward_rounded,
                color: Colors.white,
                size: 18,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// Sign in prompt.

class _SignInPrompt extends StatelessWidget {
  const _SignInPrompt({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 4,
      children: [
        Text(
          'Already have an account?',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.75),
            fontSize: 14,
            fontWeight: FontWeight.w400,
          ),
        ),
        Semantics(
          button: true,
          label: 'Sign in',
          child: PressableScale(
            onTap: onTap,
            child: const Text(
              'Sign In',
              style: TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w700,
                decoration: TextDecoration.underline,
                decorationColor: Colors.white,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
