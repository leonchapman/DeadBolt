var app = angular.module('PasswordPortal', ['ngRoute', 'ngCookies', 'toastr']);

app.config(['$routeProvider', '$httpProvider', function($routeProvider, $httpProvider) {
	$httpProvider.interceptors.push('httpRequestInterceptor');
	$routeProvider.when('/', {
		controller: 'MainCtrl',
		templateUrl: 'views/main.html',
		resolve:{
			auth: ["authService", function(authService) {return authService.hasAccess();}]
		}
	})
	.when('/login', {
		controller: 'AuthCtrl',
		templateUrl: 'views/auth.html',
		resolve:{
			isLoggingin: function(){
				return true;
			}
		}
	})
	.when('/forgot', {
		controller: 'AuthCtrl',
		templateUrl: 'views/auth.html',
		resolve:{
			isLoggingin: function(){
				return false;
			}
		}
	})
	.when('/reset/:resetid', {
		controller: 'ResetCtrl',
		templateUrl: 'views/reset.html',
		resolve:{
			ResetID: ["$route", function($route){return $route.current.params.resetid;}]
		}
	})
	.otherwise({
		templateUrl: 'views/404.html'
	});
}]);

app.controller('PageController', function($http, $scope, $location, authService, toastr){

	$scope.logOut = function(){
		authService.logOut();
		$location.path('/login');
	};

	$scope.isLoggedIn = function(){
		return !!authService.getSession();
	};

	$scope.isAdmin = function(){
		return !!authService.isAdmin();
	};

});

app.factory('httpRequestInterceptor', function ($cookies) {
  return {
    request: function (config) {
      config.headers.Authorization = $cookies.get('dbpp_sc');
      return config;
    }
  };
});

app.run(["$rootScope", "$location", "toastr", function($rootScope, $location, toastr) {
  $rootScope.$on("$routeChangeError", function(event, current, previous, eventObj) {
    if (eventObj.authenticated === false) {
      toastr.error('Please Log in First');
      $location.path("/login");
    }
		else if (eventObj.AdminAuth === false) {
			toastr.error('Unauthorized to view this page');
			$location.path("/");
		}
  });
}]);